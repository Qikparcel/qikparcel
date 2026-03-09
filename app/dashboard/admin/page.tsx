"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSenders: 0,
    totalCouriers: 0,
    totalAdmins: 0,
    totalParcels: 0,
    totalTrips: 0,
    pendingParcels: 0,
    pendingTrips: 0,
    pendingKycCount: 0,
    pendingPayoutsCount: 0,
    openDisputesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single<Profile>();

        if (!profileData) {
          router.push("/dashboard");
          return;
        }

        if (profileData.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setProfile(profileData);

        // Fetch admin stats
        const statsResponse = await fetch("/api/admin/stats");
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStats(statsData.stats);
          }
        }
      } catch (error) {
        console.error("Error loading admin dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You do not have permission to access this page.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
          Manage users, parcels, trips, and platform operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalUsers}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <div>
              <span className="text-gray-600">Senders:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {stats.totalSenders}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Couriers:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {stats.totalCouriers}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Parcels</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalParcels}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-600">Pending: </span>
            <span className="text-sm font-semibold text-yellow-600">
              {stats.pendingParcels}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Trips</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalTrips}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-600">Scheduled: </span>
            <span className="text-sm font-semibold text-blue-600">
              {stats.pendingTrips}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Admins</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalAdmins}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard/admin/users"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">User Management</h3>
              <p className="text-sm text-gray-600">View and manage all users</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/parcels"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">All Parcels</h3>
              <p className="text-sm text-gray-600">
                View and manage all parcels
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/trips"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">All Trips</h3>
              <p className="text-sm text-gray-600">View and manage all trips</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/matches"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Matches Overview</h3>
              <p className="text-sm text-gray-600">
                View parcel-trip matches and summary
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/kyc"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">KYC Review</h3>
              <p className="text-sm text-gray-600">
                Review ID, proof of address &amp; selfie
              </p>
              {stats.pendingKycCount > 0 && (
                <span className="inline-block mt-1 text-xs font-semibold text-amber-600">
                  {stats.pendingKycCount} pending
                </span>
              )}
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/payouts"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Payouts</h3>
              <p className="text-sm text-gray-600">
                Track and update courier payouts
              </p>
              {stats.pendingPayoutsCount > 0 && (
                <span className="inline-block mt-1 text-xs font-semibold text-emerald-600">
                  {stats.pendingPayoutsCount} pending
                </span>
              )}
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/disputes"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 rounded-lg">
              <svg
                className="w-6 h-6 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Disputes</h3>
              <p className="text-sm text-gray-600">
                View and resolve parcel disputes
              </p>
              {stats.openDisputesCount > 0 && (
                <span className="inline-block mt-1 text-xs font-semibold text-rose-600">
                  {stats.openDisputesCount} open
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </DashboardLayout>
  );
}
