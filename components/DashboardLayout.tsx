"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
          .single();
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
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-3">
                <Image
                  src="/logo.jpeg"
                  alt="QikParcel Logo"
                  width={40}
                  height={40}
                  className="rounded"
                />
                <h1 className="text-xl font-bold text-gray-800">QikParcel</h1>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {profile?.full_name || profile?.phone_number}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Tabs */}
      {profile?.role === "sender" && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <Link
                href="/dashboard"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard") && pathname === "/dashboard"
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                My Parcels
              </Link>
              <Link
                href="/dashboard/parcels/new"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard/parcels/new")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Create Parcel
              </Link>
              <Link
                href="/dashboard/settings"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard/settings")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </Link>
              <Link
                href="/terms"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
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
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <Link
                href="/dashboard"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard") && pathname === "/dashboard"
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                My Trips
              </Link>
              <Link
                href="/dashboard/trips/new"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard/trips/new")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Create Trip
              </Link>
              <Link
                href="/dashboard/settings"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive("/dashboard/settings")
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </Link>
              <Link
                href="/terms"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
