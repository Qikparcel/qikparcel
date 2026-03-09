"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type KycRow = {
  id: string;
  courier_id: string;
  id_document_type: string | null;
  verification_status: string;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  courier_name: string | null;
  courier_phone: string | null;
  has_proof_of_address?: boolean;
  has_selfie_with_id?: boolean;
};

export default function AdminKycPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [list, setList] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [rejectModal, setRejectModal] = useState<{
    id: string;
    courier_name: string | null;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingDocUrl, setLoadingDocUrl] = useState<string | null>(null); // kycId or "kycId-doc" for which button

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
        await loadKyc();
      } catch (error) {
        console.error("Error loading admin KYC page:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadKyc() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/kyc?${params.toString()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setList(data.list || []);
      } else {
        toast.error(data.error || "Failed to load KYC list");
      }
    } catch (error) {
      console.error("Error loading KYC:", error);
      toast.error("Failed to load KYC list");
    }
  }

  useEffect(() => {
    if (profile?.role === "admin") loadKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, profile?.role]);

  async function handleViewDocument(
    kycId: string,
    doc: "id" | "proof_of_address" | "selfie_with_id" = "id"
  ) {
    const key = doc === "id" ? kycId : `${kycId}-${doc}`;
    setLoadingDocUrl(key);
    try {
      const url =
        doc === "id"
          ? `/api/admin/kyc/${kycId}/document-url`
          : `/api/admin/kyc/${kycId}/document-url?doc=${doc}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error(data.error || "Could not open document");
      }
    } catch {
      toast.error("Could not open document");
    } finally {
      setLoadingDocUrl(null);
    }
  }

  async function handleApprove(kycId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/kyc/${kycId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_status: "approved" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("KYC approved");
        await loadKyc();
      } else {
        toast.error(data.error || "Failed to approve");
      }
    } catch {
      toast.error("Failed to approve");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/kyc/${rejectModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_status: "rejected",
          rejection_reason: rejectReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("KYC rejected");
        setRejectModal(null);
        setRejectReason("");
        await loadKyc();
      } else {
        toast.error(data.error || "Failed to reject");
      }
    } catch {
      toast.error("Failed to reject");
    } finally {
      setSubmitting(false);
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
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              KYC Review
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Review and approve courier documents: ID, proof of address, and
              selfie with ID
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
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Courier
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.length > 0 ? (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="text-sm font-medium text-gray-900">
                        {row.courier_name || "No name"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.courier_phone}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 align-top">
                      {row.id_document_type?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600">ID</span>
                          <button
                            type="button"
                            onClick={() => handleViewDocument(row.id, "id")}
                            disabled={!!loadingDocUrl}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50 underline"
                          >
                            {loadingDocUrl === row.id ? "Loading…" : "View"}
                          </button>
                        </div>
                        {row.has_proof_of_address ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600">Proof</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDocument(row.id, "proof_of_address")
                              }
                              disabled={!!loadingDocUrl}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50 underline"
                            >
                              {loadingDocUrl === `${row.id}-proof_of_address`
                                ? "Loading…"
                                : "View"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Proof —</span>
                        )}
                        {row.has_selfie_with_id ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600">Selfie</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDocument(row.id, "selfie_with_id")
                              }
                              disabled={!!loadingDocUrl}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50 underline"
                            >
                              {loadingDocUrl === `${row.id}-selfie_with_id`
                                ? "Loading…"
                                : "View"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Selfie —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap align-top">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          statusColors[row.verification_status] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {row.verification_status}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 align-top">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium align-top">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {row.verification_status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(row.id)}
                              disabled={submitting}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRejectModal({
                                  id: row.id,
                                  courier_name: row.courier_name,
                                })
                              }
                              disabled={submitting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {statusFilter !== "all"
                      ? "No KYC records match the selected filter"
                      : "No KYC records yet"}
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

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject KYC</h3>
            <p className="text-sm text-gray-600 mb-4">
              Optional: add a reason to show the courier (e.g. &quot;Document
              expired&quot;).
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason (optional)"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
