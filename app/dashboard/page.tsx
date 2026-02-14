"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Database } from "@/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [parcelIdFilter, setParcelIdFilter] = useState("");
  const [parcelStatusFilter, setParcelStatusFilter] = useState("all");
  const [tripIdFilter, setTripIdFilter] = useState("");
  const [tripStatusFilter, setTripStatusFilter] = useState("all");

  useEffect(() => {
    // Check for stored errors from callback page
    const checkStoredErrors = () => {
      const profileError = localStorage.getItem("profile_update_error");
      const authError = localStorage.getItem("auth_callback_error");

      if (profileError) {
        try {
          const errorData = JSON.parse(profileError);
          console.error(
            "[DASHBOARD] Profile update error from callback:",
            errorData
          );
          toast.error(`Profile update failed: ${errorData.message}`, {
            duration: 10000,
          });
          // Clear error after showing
          localStorage.removeItem("profile_update_error");
        } catch (err) {
          console.error("Error parsing stored profile error:", err);
        }
      }

      if (authError) {
        try {
          const errorData = JSON.parse(authError);
          console.error("[DASHBOARD] Auth callback error:", errorData);
          // Clear error after logging
          localStorage.removeItem("auth_callback_error");
        } catch (err) {
          console.error("Error parsing stored auth error:", err);
        }
      }
    };

    checkStoredErrors();

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

        if (profileData) {
          setProfile(profileData as any);

          // Load parcels or trips based on role
          const role = (profileData as any)?.role;
          if (role === "sender") {
            const parcelsResponse = await fetch("/api/parcels");
            const parcelsData = await parcelsResponse.json();
            if (parcelsData.success) {
              setParcels(parcelsData.parcels || []);
            }
          } else if (role === "courier") {
            const tripsResponse = await fetch("/api/trips");
            const tripsData = await tripsResponse.json();
            if (tripsData.success) {
              setTrips(tripsData.trips || []);
            }
          }
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const statusConfig: Record<string, { label: string; color: string }> = {
    // Parcel statuses
    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
    matched: { label: "Matched", color: "bg-blue-100 text-blue-800" },
    picked_up: { label: "Picked Up", color: "bg-purple-100 text-purple-800" },
    in_transit: { label: "In Transit", color: "bg-indigo-100 text-indigo-800" },
    delivered: { label: "Delivered", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
    // Trip statuses
    scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800" },
    in_progress: {
      label: "In Progress",
      color: "bg-purple-100 text-purple-800",
    },
    completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Sender Dashboard
  if (profile?.role === "sender") {
    const stats = {
      total: parcels.length,
      pending: parcels.filter((p) => p.status === "pending").length,
      inProgress: parcels.filter((p) =>
        ["matched", "picked_up", "in_transit"].includes(p.status)
      ).length,
      completed: parcels.filter((p) => p.status === "delivered").length,
    };

    return (
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                My Parcels
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                Manage your parcel requests and track deliveries
              </p>
            </div>
            <Link
              href="/dashboard/parcels/new"
              className="w-full sm:w-auto text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              style={{ backgroundColor: "#29772F" }}
            >
              Create Parcel
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Total Parcels</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-purple-600">
                {stats.inProgress}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <div className="text-sm text-gray-600">Delivered</div>
            </div>
          </div>
        )}

        {/* Parcels List */}
        {parcels.length > 0 ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                My Parcels
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Filter by parcel ID..."
                  value={parcelIdFilter}
                  onChange={(e) => setParcelIdFilter(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={parcelStatusFilter}
                  onChange={(e) => setParcelStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white min-w-[140px]"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="matched">Matched</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {(() => {
                const idLower = parcelIdFilter.trim().toLowerCase();
                const filtered = parcels.filter((p) => {
                  const matchId =
                    !idLower || p.id.toLowerCase().includes(idLower);
                  const matchStatus =
                    parcelStatusFilter === "all" ||
                    p.status === parcelStatusFilter;
                  return matchId && matchStatus;
                });
                return (
                  <>
                    {(parcelIdFilter || parcelStatusFilter !== "all") && (
                      <p className="mt-2 text-sm text-gray-500">
                        Showing {filtered.length} of {parcels.length} parcels
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="divide-y divide-gray-200">
              {(() => {
                const idLower = parcelIdFilter.trim().toLowerCase();
                const filteredParcels = parcels.filter((p) => {
                  const matchId =
                    !idLower || p.id.toLowerCase().includes(idLower);
                  const matchStatus =
                    parcelStatusFilter === "all" ||
                    p.status === parcelStatusFilter;
                  return matchId && matchStatus;
                });
                return filteredParcels.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No parcels match your filters. Try changing the ID or
                    status.
                  </div>
                ) : (
                  filteredParcels.map((parcel) => (
                    <div key={parcel.id} className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/parcels/${parcel.id}`}
                        className="flex-1 block p-4 sm:p-6 hover:bg-gray-50 transition min-w-0"
                      >
                        <div className="flex items-start sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                                Parcel #{parcel.id.slice(0, 8)}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                  statusConfig[parcel.status]?.color ||
                                  "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {statusConfig[parcel.status]?.label ||
                                  parcel.status}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">
                              <span className="font-medium">From:</span>{" "}
                              <span className="truncate block sm:inline">
                                {parcel.pickup_address.substring(0, 40)}
                              </span>
                              {parcel.pickup_address.length > 40 && "..."}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">
                              <span className="font-medium">To:</span>{" "}
                              <span className="truncate block sm:inline">
                                {parcel.delivery_address.substring(0, 40)}
                              </span>
                              {parcel.delivery_address.length > 40 && "..."}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Created {formatDate(parcel.created_at)}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </Link>
                      {parcel.status === "pending" && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (
                              !window.confirm(
                                "Delete this parcel? This cannot be undone."
                              )
                            )
                              return;
                            const res = await fetch(
                              `/api/parcels/${parcel.id}`,
                              {
                                method: "DELETE",
                              }
                            );
                            const data = await res.json();
                            if (res.ok) {
                              toast.success("Parcel deleted");
                              setParcels((prev) =>
                                prev.filter((p) => p.id !== parcel.id)
                              );
                            } else {
                              toast.error(data.error || "Failed to delete");
                            }
                          }}
                          className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Delete parcel"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-5xl sm:text-6xl mb-4">📦</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                No parcels yet
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Get started by creating your first parcel request
              </p>
              <Link
                href="/dashboard/parcels/new"
                className="inline-block w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                style={{ backgroundColor: "#29772F" }}
              >
                Create Your First Parcel
              </Link>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Courier Dashboard
  if (profile?.role === "courier") {
    const stats = {
      total: trips.length,
      pending: trips.filter((t) => t.status === "scheduled").length,
      inProgress: trips.filter((t) => t.status === "in_progress").length,
      completed: trips.filter((t) => t.status === "completed").length,
    };

    return (
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                My Trips
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                Manage your trip routes and deliveries
              </p>
            </div>
            <Link
              href="/dashboard/trips/new"
              className="w-full sm:w-auto text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              style={{ backgroundColor: "#29772F" }}
            >
              Create Trip
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Total Trips</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-600">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-600">Scheduled</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-purple-600">
                {stats.inProgress}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
          </div>
        )}

        {/* Trips List */}
        {trips.length > 0 ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">My Trips</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Filter by trip ID..."
                  value={tripIdFilter}
                  onChange={(e) => setTripIdFilter(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={tripStatusFilter}
                  onChange={(e) => setTripStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white min-w-[140px]"
                >
                  <option value="all">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {(tripIdFilter || tripStatusFilter !== "all") && (
                <p className="mt-2 text-sm text-gray-500">
                  Showing{" "}
                  {
                    trips.filter((t) => {
                      const idLower = tripIdFilter.trim().toLowerCase();
                      const matchId =
                        !idLower || t.id.toLowerCase().includes(idLower);
                      const matchStatus =
                        tripStatusFilter === "all" ||
                        t.status === tripStatusFilter;
                      return matchId && matchStatus;
                    }).length
                  }{" "}
                  of {trips.length} trips
                </p>
              )}
            </div>
            <div className="divide-y divide-gray-200">
              {(() => {
                const idLower = tripIdFilter.trim().toLowerCase();
                const filteredTrips = trips.filter((t) => {
                  const matchId =
                    !idLower || t.id.toLowerCase().includes(idLower);
                  const matchStatus =
                    tripStatusFilter === "all" || t.status === tripStatusFilter;
                  return matchId && matchStatus;
                });
                return filteredTrips.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No trips match your filters. Try changing the ID or status.
                  </div>
                ) : (
                  filteredTrips.map((trip) => (
                    <div key={trip.id} className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/trips/${trip.id}`}
                        className="flex-1 block p-4 sm:p-6 hover:bg-gray-50 transition min-w-0"
                      >
                        <div className="flex items-start sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                                Trip #{trip.id.slice(0, 8)}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                  statusConfig[trip.status]?.color ||
                                  "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {statusConfig[trip.status]?.label ||
                                  trip.status}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">
                              <span className="font-medium">From:</span>{" "}
                              <span className="truncate block sm:inline">
                                {trip.origin_address.substring(0, 40)}
                              </span>
                              {trip.origin_address.length > 40 && "..."}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">
                              <span className="font-medium">To:</span>{" "}
                              <span className="truncate block sm:inline">
                                {trip.destination_address.substring(0, 40)}
                              </span>
                              {trip.destination_address.length > 40 && "..."}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Created {formatDate(trip.created_at)}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </Link>
                      {trip.status === "scheduled" && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (
                              !window.confirm(
                                "Delete this trip? This cannot be undone."
                              )
                            )
                              return;
                            const res = await fetch(`/api/trips/${trip.id}`, {
                              method: "DELETE",
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast.success("Trip deleted");
                              setTrips((prev) =>
                                prev.filter((t) => t.id !== trip.id)
                              );
                            } else {
                              toast.error(data.error || "Failed to delete");
                            }
                          }}
                          className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Delete trip"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-5xl sm:text-6xl mb-4">🚚</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                No trips yet
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Get started by creating your first trip route
              </p>
              <Link
                href="/dashboard/trips/new"
                className="inline-block w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                style={{ backgroundColor: "#29772F" }}
              >
                Create Your First Trip
              </Link>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Fallback for users without a role or admin
  return (
    <DashboardLayout>
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to QikParcel
          </h2>
          <p className="text-gray-600 mb-6">
            Your account is being set up. Please contact support if you need
            assistance.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
