"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectStatus, setConnectStatus] = useState<{
    hasAccount: boolean;
    onboarded: boolean;
    canReceivePayouts: boolean;
  } | null>(null);
  const [showStripeConnectModal, setShowStripeConnectModal] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  console.log("[DashboardLayout] Component rendering, loading:", loading);

  useEffect(() => {
    console.log("[DashboardLayout] useEffect running");

    async function loadUser() {
      console.log("[DashboardLayout] loadUser function called");
      try {
        const supabase = createSupabaseClient();
        console.log("[DashboardLayout] Supabase client created");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        console.log("[DashboardLayout] Session check complete", {
          session: !!session,
          error: sessionError,
        });

        if (sessionError || !session) {
          console.log("[DashboardLayout] No session, redirecting to login");
          setLoading(false);
          router.push("/login");
          return;
        }

        console.log("[DashboardLayout] Setting user");
        setUser(session.user);

        console.log("[DashboardLayout] Fetching profile");
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single<Profile>();
        console.log("[DashboardLayout] Profile fetch complete", {
          profile: !!profileData,
          error: profileError,
        });

        if (profileError) {
          console.error(
            "[DashboardLayout] Error loading profile:",
            profileError
          );
          setProfile(null);
        } else {
          setProfile(profileData);

          // Courier Stripe Connect: fetch status and show modal if not onboarded
          if (profileData?.role === "courier") {
            try {
              const res = await fetch("/api/connect/status");
              const data = await res.json();
              if (res.ok) {
                setConnectStatus(data);
                if (
                  !data.onboarded &&
                  typeof window !== "undefined" &&
                  !sessionStorage.getItem("courier_stripe_modal_dismissed")
                ) {
                  setShowStripeConnectModal(true);
                }
              }
            } catch {
              setConnectStatus(null);
            }
          }
        }

        console.log("[DashboardLayout] Setting loading to false");
        setLoading(false);
      } catch (error) {
        console.error("[DashboardLayout] Error in loadUser:", error);
        setLoading(false);
      }
    }

    loadUser();

    const supabase = createSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/login");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When courier returns from Stripe onboarding, refetch status so modal closes
  useEffect(() => {
    if (
      pathname === "/dashboard/settings" &&
      profile?.role === "courier" &&
      typeof window !== "undefined"
    ) {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("connect") === "success" ||
        params.get("connect") === "refresh"
      ) {
        fetch("/api/connect/status")
          .then((res) => res.json())
          .then((data) => {
            if (!data.error) {
              setConnectStatus(data);
              if (data.onboarded) setShowStripeConnectModal(false);
            }
          })
          .catch(() => {});
      }
    }
  }, [pathname, profile?.role]);

  const handleStripeConnectDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("courier_stripe_modal_dismissed", "1");
    }
    setShowStripeConnectModal(false);
  };

  const handleStripeConnectOpen = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start setup");
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      console.error("[DashboardLayout] Stripe onboard error:", e);
      setConnectLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Call logout API route to properly clear server-side cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      // Also clear client-side session
      const supabase = createSupabaseClient();
      try {
        await supabase.auth.signOut();
      } catch (clientError) {
        // Ignore client-side errors, server-side logout is more important
        console.log("Client-side logout error (ignored):", clientError);
      }

      // Clear any local storage
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Force full page reload to ensure all state is cleared
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, redirect to login and clear storage
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + "/");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 sm:gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Image
                  src="/logo.jpeg"
                  alt="QikParcel Logo"
                  width={32}
                  height={32}
                  className="rounded sm:w-10 sm:h-10"
                />
                <h1 className="text-lg sm:text-xl font-bold text-gray-800">
                  QikParcel
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[150px]">
                {profile?.full_name || profile?.phone_number}
              </span>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {(mobileMenuOpen || profile?.role) && (
        <div
          className={`${
            mobileMenuOpen ? "block" : "hidden"
          } sm:hidden bg-white border-b`}
        >
          <div className="px-4 py-3 space-y-2">
            <div className="pb-3 border-b border-gray-200 mb-2">
              <p className="text-sm font-medium text-gray-900">
                {profile?.full_name || profile?.phone_number}
              </p>
              <button
                onClick={handleLogout}
                className="mt-2 w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Logout
              </button>
            </div>
            {profile?.role === "sender" && (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard") && pathname === "/dashboard"
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  My Parcels
                </Link>
                <Link
                  href="/dashboard/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/chat")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Chat
                </Link>
                <Link
                  href="/dashboard/parcels/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/parcels/new")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Create Parcel
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/settings")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Settings
                </Link>
                <Link
                  href="/terms/help"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/terms/help")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Help & Support
                </Link>
                <Link
                  href="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/terms")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Terms
                </Link>
              </>
            )}
            {profile?.role === "courier" && (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard") && pathname === "/dashboard"
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  My Trips
                </Link>
                <Link
                  href="/dashboard/matched-parcels"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/matched-parcels")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Matched Parcels
                </Link>
                <Link
                  href="/dashboard/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/chat")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Chat
                </Link>
                <Link
                  href="/dashboard/trips/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/trips/new")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Create Trip
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/settings")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Settings
                </Link>
                <Link
                  href="/terms/help"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/terms/help")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Help & Support
                </Link>
                <Link
                  href="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/terms")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Terms
                </Link>
              </>
            )}
            {profile?.role === "admin" && (
              <>
                <Link
                  href="/dashboard/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/admin") &&
                    pathname === "/dashboard/admin"
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Admin Dashboard
                </Link>
                <Link
                  href="/dashboard/admin/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/admin/users")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  User Management
                </Link>
                <Link
                  href="/dashboard/admin/parcels"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/admin/parcels")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  All Parcels
                </Link>
                <Link
                  href="/dashboard/admin/trips"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/admin/trips")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  All Trips
                </Link>
                <Link
                  href="/dashboard/admin/matches"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/admin/matches")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Matches Overview
                </Link>
                <Link
                  href="/dashboard/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/chat")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Chat
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-3 rounded-lg text-sm font-medium ${
                    isActive("/dashboard/settings")
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Settings
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Desktop Navigation Tabs */}
      {profile?.role === "sender" && (
        <div className="hidden sm:block bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8 overflow-x-auto">
              <Link
                href="/dashboard"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard") && pathname === "/dashboard"
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                My Parcels
              </Link>
              <Link
                href="/dashboard/chat"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/chat")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/dashboard/parcels/new"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/parcels/new")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Create Parcel
              </Link>
              <Link
                href="/dashboard/settings"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/settings")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </Link>
              <Link
                href="/terms/help"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/terms/help")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Help & Support
              </Link>
              <Link
                href="/terms"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/terms")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Terms
              </Link>
            </nav>
          </div>
        </div>
      )}

      {profile?.role === "courier" && (
        <div className="hidden sm:block bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8 overflow-x-auto">
              <Link
                href="/dashboard"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard") && pathname === "/dashboard"
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                My Trips
              </Link>
              <Link
                href="/dashboard/matched-parcels"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/matched-parcels")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Matched Parcels
              </Link>
              <Link
                href="/dashboard/chat"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/chat")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/dashboard/trips/new"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/trips/new")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Create Trip
              </Link>
              <Link
                href="/dashboard/settings"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/settings")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </Link>
              <Link
                href="/terms/help"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/terms/help")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Help & Support
              </Link>
              <Link
                href="/terms"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/terms")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Terms
              </Link>
            </nav>
          </div>
        </div>
      )}

      {profile?.role === "admin" && (
        <div className="hidden sm:block bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8 overflow-x-auto">
              <Link
                href="/dashboard/admin"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/admin") &&
                  pathname === "/dashboard/admin"
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Admin Dashboard
              </Link>
              <Link
                href="/dashboard/admin/users"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/admin/users")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                User Management
              </Link>
              <Link
                href="/dashboard/admin/parcels"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/admin/parcels")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                All Parcels
              </Link>
              <Link
                href="/dashboard/admin/trips"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/admin/trips")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                All Trips
              </Link>
              <Link
                href="/dashboard/admin/matches"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/admin/matches")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Matches Overview
              </Link>
              <Link
                href="/dashboard/chat"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/chat")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/dashboard/settings"
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  isActive("/dashboard/settings")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Stripe Connect modal for couriers who haven't connected */}
      {showStripeConnectModal && connectStatus && !connectStatus.onboarded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Connect Stripe to get paid
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              To receive delivery fees when you complete deliveries, connect
              your Stripe account. You can do this now or from Settings later.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleStripeConnectOpen}
                disabled={connectLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition disabled:opacity-50"
                style={{ backgroundColor: "#29772F" }}
              >
                {connectLoading
                  ? "Opening..."
                  : connectStatus.hasAccount
                  ? "Complete setup"
                  : "Connect Stripe"}
              </button>
              <button
                type="button"
                onClick={handleStripeConnectDismiss}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Remind me later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
