"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type DisputeRow = {
  id: string;
  parcel_id: string;
  raised_by: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  raiser_name: string | null;
  raiser_phone: string | null;
};

export default function AdminDisputesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [list, setList] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "investigating" | "resolved" | "closed"
  >("all");

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

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single<Profile>();

        if (!profileData || profileData.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setProfile(profileData);
        await loadDisputes();
      } catch (error) {
        console.error("Error loading admin disputes page:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadDisputes() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/disputes?${params.toString()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setList(data.list || []);
      } else {
        toast.error(data.error || "Failed to load disputes");
      }
    } catch (error) {
      console.error("Error loading disputes:", error);
      toast.error("Failed to load disputes");
    }
  }

  useEffect(() => {
    if (profile?.role === "admin") loadDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, profile?.role]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
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

  const statusColors: Record<string, string> = {
    open: "bg-yellow-100 text-yellow-800",
    investigating: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Disputes
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              View and resolve parcel disputes
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label htmlFor="statusFilter" className="sr-only">
              Filter by status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raised by
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.length > 0 ? (
                list.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/admin/disputes/${row.id}`)
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/parcels/${row.parcel_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        #{row.parcel_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {row.raiser_name || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.raiser_phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {row.dispute_type.replace("_", " ")}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p
                        className="text-sm text-gray-900 truncate"
                        title={row.description}
                      >
                        {row.description}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          statusColors[row.status] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/admin/disputes/${row.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-600 hover:text-primary-900"
                        style={{ color: "#29772F" }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {statusFilter !== "all"
                      ? "No disputes match the selected filter"
                      : "No disputes yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Total: {list.length}
        {statusFilter !== "all" ? " (filtered)" : ""}. Click a row to open.
      </div>
    </DashboardLayout>
  );
}
