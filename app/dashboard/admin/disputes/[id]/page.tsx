"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type DisputeDetail = {
  id: string;
  parcel_id: string;
  raised_by: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  parcel: {
    id: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
  } | null;
  raiser: { id: string; full_name: string | null; phone_number: string } | null;
};

type HistoryEntry = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_name: string;
  notes: string | null;
  created_at: string;
};

export default function AdminDisputeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const statusColors: Record<string, string> = {
    open: "bg-yellow-100 text-yellow-800",
    investigating: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };

  useEffect(() => {
    async function loadData() {
      if (!disputeId) return;
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

        const res = await fetch(`/api/admin/disputes/${disputeId}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load dispute");
          router.push("/dashboard/admin/disputes");
          return;
        }
        if (data.success && data.dispute) {
          setDispute(data.dispute);
          setHistory(data.history || []);
          setStatus(data.dispute.status);
          setResolutionNotes(data.dispute.resolution_notes || "");
        }
      } catch (error) {
        console.error("Error loading dispute:", error);
        toast.error("Failed to load dispute");
        router.push("/dashboard/admin/disputes");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [disputeId, router]);

  async function handleUpdate() {
    if (!dispute) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolution_notes: resolutionNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Dispute updated");
        const refetch = await fetch(`/api/admin/disputes/${disputeId}`);
        const refetchData = await refetch.json();
        if (refetchData.success) {
          setDispute(refetchData.dispute);
          setHistory(refetchData.history || []);
        }
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile || profile.role !== "admin" || !dispute) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Dispute not found
          </h2>
          <Link
            href="/dashboard/admin/disputes"
            className="text-primary-600 hover:underline"
            style={{ color: "#29772F" }}
          >
            ← Back to Disputes
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/dashboard/admin/disputes"
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to Disputes
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Dispute #{dispute.id.slice(0, 8)}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {dispute.dispute_type.replace("_", " ")} · Created{" "}
          {formatDate(dispute.created_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Parcel</dt>
              <dd>
                <Link
                  href={`/dashboard/parcels/${dispute.parcel_id}`}
                  className="text-blue-600 hover:text-blue-900 font-medium"
                >
                  #{dispute.parcel_id.slice(0, 8)}
                </Link>
                {dispute.parcel && (
                  <span className="ml-2 text-gray-600">
                    {dispute.parcel.pickup_address?.slice(0, 40)}... →{" "}
                    {dispute.parcel.delivery_address?.slice(0, 40)}...
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Raised by</dt>
              <dd className="text-gray-900">
                {dispute.raiser?.full_name || "—"}{" "}
                {dispute.raiser?.phone_number && (
                  <span className="text-gray-500">
                    ({dispute.raiser.phone_number})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Type</dt>
              <dd className="text-gray-900 capitalize">
                {dispute.dispute_type.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span
                  className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${
                    statusColors[dispute.status] ?? "bg-gray-100 text-gray-800"
                  }`}
                >
                  {dispute.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Description</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">
                {dispute.description}
              </dd>
            </div>
            {dispute.resolution_notes && (
              <div>
                <dt className="text-gray-500">Resolution notes</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">
                  {dispute.resolution_notes}
                </dd>
              </div>
            )}
          </dl>

          {/* Update form */}
          <div className="border-t pt-4 mt-4 space-y-4">
            <h3 className="font-medium text-gray-900">Update status</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            >
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
              placeholder="Resolution notes (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            />
            <button
              type="button"
              onClick={handleUpdate}
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              style={{ backgroundColor: "#29772F" }}
            >
              {submitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        {/* Status history */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Status history
          </h2>
          <div className="space-y-4">
            {/* Initial "Raised" entry */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                {history.length > 0 && (
                  <div className="w-0.5 flex-1 bg-gray-200 min-h-[8px]" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium text-gray-900">
                  Dispute raised
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(dispute.created_at)}
                </p>
                <span
                  className={`mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded ${
                    statusColors.open ?? "bg-gray-100"
                  }`}
                >
                  open
                </span>
              </div>
            </div>

            {history.map((entry, idx) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  {idx < history.length - 1 ? (
                    <div className="w-0.5 flex-1 bg-gray-200 min-h-[8px]" />
                  ) : null}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.from_status
                      ? `${entry.from_status} → ${entry.to_status}`
                      : `Status set to ${entry.to_status}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(entry.created_at)} · by {entry.changed_by_name}
                  </p>
                  {entry.notes && (
                    <p className="mt-1 text-sm text-gray-600">{entry.notes}</p>
                  )}
                  <span
                    className={`mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded ${
                      statusColors[entry.to_status] ?? "bg-gray-100"
                    }`}
                  >
                    {entry.to_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
