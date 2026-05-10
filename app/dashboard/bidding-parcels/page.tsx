"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

type BiddingParcel = Parcel & {
  bidding_estimate_amount?: number | null;
  bidding_min_amount?: number | null;
  bidding_max_amount?: number | null;
  bidding_closes_at?: string | null;
  bidding_currency?: string | null;
  my_bid?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    message: string | null;
  } | null;
};

const WINDOW_OPTIONS = [1, 4, 12, 24] as const;

export default function BiddingParcelsPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<BiddingParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [userId, setUserId] = useState<string | null>(null);

  // Bid form state per parcel
  const [bidForm, setBidForm] = useState<
    Record<
      string,
      {
        open: boolean;
        amount: string;
        message: string;
        estimated_delivery_at: string;
        submitting: boolean;
        withdrawing: boolean;
      }
    >
  >({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadParcels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bidding/open-parcels");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setParcels(data.parcels ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load bidding parcels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single<{ role: "sender" | "courier" | "admin" }>();
      if (!profile || profile.role !== "courier") {
        toast.error("Only couriers can access the bidding feed");
        router.push("/dashboard");
        return;
      }
      setUserId(session.user.id);
      await loadParcels();
    }
    init();
  }, [router, loadParcels]);

  function formatCountdown(closesAt: string): string {
    const diff = new Date(closesAt).getTime() - now;
    if (diff <= 0) return "Closed";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function getBidForm(parcelId: string) {
    return (
      bidForm[parcelId] ?? {
        open: false,
        amount: "",
        message: "",
        estimated_delivery_at: "",
        submitting: false,
        withdrawing: false,
      }
    );
  }

  function updateBidForm(
    parcelId: string,
    patch: Partial<(typeof bidForm)[string]>
  ) {
    setBidForm((prev) => ({
      ...prev,
      [parcelId]: { ...getBidForm(parcelId), ...patch },
    }));
  }

  async function handleSubmitBid(parcel: BiddingParcel) {
    const form = getBidForm(parcel.id);
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid bid amount");
      return;
    }
    updateBidForm(parcel.id, { submitting: true });
    try {
      const res = await fetch(`/api/bidding/parcels/${parcel.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: parcel.bidding_currency || "USD",
          message: form.message.trim() || undefined,
          estimated_delivery_at: form.estimated_delivery_at || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place bid");
      toast.success("Bid placed!");
      updateBidForm(parcel.id, {
        open: false,
        amount: "",
        message: "",
        estimated_delivery_at: "",
      });
      await loadParcels();
    } catch (err: any) {
      toast.error(err.message || "Failed to place bid");
    } finally {
      updateBidForm(parcel.id, { submitting: false });
    }
  }

  async function handleWithdrawBid(
    parcelId: string,
    bidId: string
  ) {
    updateBidForm(parcelId, { withdrawing: true });
    try {
      const res = await fetch(
        `/api/bidding/parcels/${parcelId}/bids/${bidId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to withdraw");
      toast.success("Bid withdrawn.");
      await loadParcels();
    } catch (err: any) {
      toast.error(err.message || "Failed to withdraw bid");
    } finally {
      updateBidForm(parcelId, { withdrawing: false });
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Open for Bidding</h1>
          <p className="mt-2 text-gray-600">
            Parcels where senders are accepting courier bids. Place your offer
            — you win when the sender picks you.
          </p>
        </div>

        {parcels.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center">
            <p className="text-gray-500">
              No parcels are currently open for bidding.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Check back soon, or browse{" "}
              <Link
                href="/dashboard"
                className="underline"
                style={{ color: "#29772F" }}
              >
                matched parcels
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {parcels.map((parcel) => {
              const form = getBidForm(parcel.id);
              const isOpen =
                parcel.bidding_closes_at &&
                new Date(parcel.bidding_closes_at).getTime() > now;
              const myBid = parcel.my_bid;
              const currency = parcel.bidding_currency || "USD";
              const estimate = parcel.bidding_estimate_amount;
              const minBid = parcel.bidding_min_amount;
              const maxBid = parcel.bidding_max_amount;

              return (
                <li
                  key={parcel.id}
                  className="bg-white rounded-lg shadow p-5 space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {parcel.pickup_address}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <span className="text-gray-400">→</span>
                        <span className="truncate">{parcel.delivery_address}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                        isOpen
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {parcel.bidding_closes_at
                        ? formatCountdown(parcel.bidding_closes_at)
                        : "Open"}
                    </span>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                    {parcel.weight_kg && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {parcel.weight_kg} kg
                      </span>
                    )}
                    {parcel.dimensions && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {parcel.dimensions}
                      </span>
                    )}
                    {estimate != null && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        Estimate {currency} {Number(estimate).toFixed(2)}
                      </span>
                    )}
                    {minBid != null && maxBid != null && (
                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                        Bid range {currency} {Number(minBid).toFixed(2)} –{" "}
                        {Number(maxBid).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* My existing bid */}
                  {myBid && myBid.status === "active" && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          Your bid: {myBid.currency} {myBid.amount.toFixed(2)}
                        </p>
                        {myBid.message && (
                          <p className="text-xs text-green-700 italic mt-0.5">
                            "{myBid.message}"
                          </p>
                        )}
                        <p className="text-xs text-green-600 mt-0.5">
                          Tap below to update or withdraw.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleWithdrawBid(parcel.id, myBid.id)
                        }
                        disabled={form.withdrawing}
                        className="shrink-0 text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        {form.withdrawing ? "…" : "Withdraw"}
                      </button>
                    </div>
                  )}

                  {/* Bid form toggle */}
                  {isOpen && (
                    <div>
                      {!form.open ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateBidForm(parcel.id, {
                              open: true,
                              amount: myBid?.amount.toFixed(2) ?? "",
                              message: myBid?.message ?? "",
                            })
                          }
                          className="w-full px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          style={{ backgroundColor: "#29772F" }}
                        >
                          {myBid?.status === "active"
                            ? "Update my bid"
                            : "Place a bid"}
                        </button>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900">
                              {myBid?.status === "active"
                                ? "Update your bid"
                                : "Place a bid"}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                updateBidForm(parcel.id, { open: false })
                              }
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Amount */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Your price ({currency}){" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                {currency}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min={minBid ?? 0}
                                max={maxBid ?? undefined}
                                value={form.amount}
                                onChange={(e) =>
                                  updateBidForm(parcel.id, {
                                    amount: e.target.value,
                                  })
                                }
                                placeholder={
                                  estimate
                                    ? Number(estimate).toFixed(2)
                                    : "0.00"
                                }
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                            {minBid != null && maxBid != null && (
                              <p className="mt-1 text-xs text-gray-400">
                                Allowed: {currency} {Number(minBid).toFixed(2)}{" "}
                                – {Number(maxBid).toFixed(2)}
                              </p>
                            )}
                          </div>

                          {/* Message */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Message to sender (optional)
                            </label>
                            <textarea
                              rows={2}
                              value={form.message}
                              onChange={(e) =>
                                updateBidForm(parcel.id, {
                                  message: e.target.value,
                                })
                              }
                              placeholder="e.g., I travel this route every Wednesday…"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>

                          {/* Est. delivery */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Estimated delivery date (optional)
                            </label>
                            <input
                              type="date"
                              value={form.estimated_delivery_at}
                              onChange={(e) =>
                                updateBidForm(parcel.id, {
                                  estimated_delivery_at: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSubmitBid(parcel)}
                            disabled={form.submitting || !form.amount}
                            className="w-full px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                            style={{ backgroundColor: "#29772F" }}
                          >
                            {form.submitting ? "Submitting…" : "Submit bid"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isOpen && !myBid && (
                    <p className="text-xs text-gray-400">
                      Bidding window has closed for this parcel.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
