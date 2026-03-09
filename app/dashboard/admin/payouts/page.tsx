"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type PayoutRow = {
  id: string;
  courier_id: string;
  parcel_id: string;
  amount: number;
  status: string;
  processed_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  courier_name: string | null;
  courier_phone: string | null;
  parcel_status: string | null;
};

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [list, setList] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "processed" | "paid" | "failed"
  >("all");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    id: string;
    action: "processed" | "paid" | "failed";
    payment_reference: string;
    notes: string;
  } | null>(null);

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
        await loadPayouts();
      } catch (error) {
        console.error("Error loading admin payouts page:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadPayouts() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/payouts?${params.toString()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setList(data.list || []);
      } else {
        toast.error(data.error || "Failed to load payouts");
      }
    } catch (error) {
      console.error("Error loading payouts:", error);
      toast.error("Failed to load payouts");
    }
  }

  useEffect(() => {
    if (profile?.role === "admin") loadPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, profile?.role]);

  async function handleUpdateStatus(
    payoutId: string,
    status: "processed" | "paid" | "failed",
    payment_reference?: string,
    notes?: string
  ) {
    setSubmitting(payoutId);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          payment_reference: payment_reference || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          status === "paid"
            ? "Marked as paid"
            : status === "failed"
            ? "Marked as failed"
            : "Marked as processed"
        );
        setActionModal(null);
        await loadPayouts();
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSubmitting(null);
    }
  }

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
    pending: "bg-yellow-100 text-yellow-800",
    processed: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Payout tracking
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              View and update courier payouts
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
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
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
                  Courier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed / Reference
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.length > 0 ? (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {row.courier_name || "No name"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.courier_phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/parcels/${row.parcel_id}`}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        #{row.parcel_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${Number(row.amount).toFixed(2)}
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
                      {row.processed_at
                        ? new Date(row.processed_at).toLocaleDateString()
                        : "—"}
                      {row.payment_reference && (
                        <div className="text-xs text-gray-400">
                          Ref: {row.payment_reference}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {row.status === "pending" && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              setActionModal({
                                id: row.id,
                                action: "processed",
                                payment_reference: "",
                                notes: "",
                              })
                            }
                            disabled={!!submitting}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          >
                            Mark processed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(row.id, "paid")}
                            disabled={!!submitting}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActionModal({
                                id: row.id,
                                action: "failed",
                                payment_reference: "",
                                notes: "",
                              })
                            }
                            disabled={!!submitting}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Mark failed
                          </button>
                        </div>
                      )}
                      {row.status === "processed" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(row.id, "paid")}
                            disabled={!!submitting}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {statusFilter !== "all"
                      ? "No payouts match the selected filter"
                      : "No payouts yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Total: {list.length}
        {statusFilter !== "all" ? " (filtered)" : ""}
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {actionModal.action === "processed"
                ? "Mark as processed"
                : actionModal.action === "failed"
                ? "Mark as failed"
                : "Update payout"}
            </h3>
            <div className="space-y-4">
              {actionModal.action !== "failed" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment reference (optional)
                  </label>
                  <input
                    type="text"
                    value={actionModal.payment_reference}
                    onChange={(e) =>
                      setActionModal((m) =>
                        m ? { ...m, payment_reference: e.target.value } : null
                      )
                    }
                    placeholder="e.g. bank transfer ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={actionModal.notes}
                  onChange={(e) =>
                    setActionModal((m) =>
                      m ? { ...m, notes: e.target.value } : null
                    )
                  }
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={submitting !== null}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    actionModal.id,
                    actionModal.action,
                    actionModal.payment_reference || undefined,
                    actionModal.notes || undefined
                  )
                }
                disabled={submitting !== null}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                style={{ backgroundColor: "#29772F" }}
              >
                {submitting === actionModal.id ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
