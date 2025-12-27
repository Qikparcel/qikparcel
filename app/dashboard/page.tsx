"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseClient();

      // Get current session first
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    }

    loadUser();

    // Listen for auth changes
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
  }, [router]);

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect even if logout fails
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.jpeg"
                alt="QikParcel Logo"
                width={60}
                height={60}
              />
              <h1 className="text-xl font-bold text-gray-800">QikParcel</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {profile?.full_name || profile?.phone_number}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                style={{ border: "1px solid #e5e7eb" }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {profile?.full_name || profile?.phone_number || "User"}!
          </h1>
          <p className="mt-2 text-gray-600">
            {profile?.role === "sender" &&
              "Manage your parcels and track deliveries"}
            {profile?.role === "courier" && "Manage your trips and deliveries"}
            {profile?.role === "admin" && "Manage the platform and users"}
            {!profile?.role && "Welcome to QikParcel"}
          </p>
        </div>

        {/* Role-based Dashboard Content */}
        {profile?.role === "sender" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                Sender Dashboard
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-gray-900">
                    Create New Parcel
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Send your parcel and find a courier to deliver it.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                    Create Parcel (Coming Soon)
                  </button>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-gray-900">My Parcels</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    View and track all your parcel requests.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                    View Parcels (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {profile?.role === "courier" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                Courier Dashboard
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold text-gray-900">
                    Create New Trip
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Create a trip route and start accepting parcel deliveries.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm">
                    Create Trip (Coming Soon)
                  </button>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h3 className="font-semibold text-gray-900">
                    Available Parcels
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Browse parcels that match your route.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm">
                    Browse Parcels (Coming Soon)
                  </button>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-gray-900">My Deliveries</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Track your active and completed deliveries.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                    View Deliveries (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {profile?.role === "admin" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                Admin Dashboard
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold text-gray-900">
                    User Management
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Manage users, roles, and permissions.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm">
                    Manage Users (Coming Soon)
                  </button>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Disputes</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Review and resolve parcel disputes.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm">
                    View Disputes (Coming Soon)
                  </button>
                </div>
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h3 className="font-semibold text-gray-900">
                    Platform Analytics
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    View platform statistics and reports.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm">
                    View Analytics (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Section */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Your Profile</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Phone Number
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {profile?.phone_number || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {profile?.full_name || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">
                {profile?.role || "sender"}
              </dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
