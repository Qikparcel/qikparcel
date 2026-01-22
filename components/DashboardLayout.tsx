"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database['public']['Tables']['profiles']['Row'];

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

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/login");
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
              <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3" onClick={() => setMobileMenuOpen(false)}>
                <Image
                  src="/logo.jpeg"
                  alt="QikParcel Logo"
                  width={32}
                  height={32}
                  className="rounded sm:w-10 sm:h-10"
                />
                <h1 className="text-lg sm:text-xl font-bold text-gray-800">QikParcel</h1>
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:hidden bg-white border-b`}>
          <div className="px-4 py-3 space-y-2">
            <div className="pb-3 border-b border-gray-200 mb-2">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || profile?.phone_number}</p>
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
                    isActive("/dashboard/admin")
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
                  isActive("/dashboard/admin") && pathname === "/dashboard/admin"
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
    </div>
  );
}
