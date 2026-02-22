"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ChattableParcel {
  id: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  other_party_name: string | null;
}

export default function ChatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [parcels, setParcels] = useState<ChattableParcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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

      if (!profileData) {
        router.push("/login");
        return;
      }
      setProfile(profileData);

      if (profileData.role === "sender") {
        const res = await fetch("/api/parcels");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load parcels");
          setLoading(false);
          return;
        }
        const all = (data.parcels || []).filter(
          (p: { status: string; matched_trip_id?: string | null }) =>
            p.status === "matched" && p.matched_trip_id
        );
        setParcels(
          all.map((p: any) => ({
            id: p.id,
            pickup_address: p.pickup_address,
            delivery_address: p.delivery_address,
            status: p.status,
            other_party_name: "Courier",
          }))
        );
      } else if (profileData.role === "courier") {
        const res = await fetch("/api/courier/matched-parcels");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load parcels");
          setLoading(false);
          return;
        }
        const all = (data.parcels || []).filter(
          (p: { status: string }) => p.status === "matched"
        );
        setParcels(
          all.map((p: any) => ({
            id: p.id,
            pickup_address: p.pickup_address,
            delivery_address: p.delivery_address,
            status: p.status,
            other_party_name: p.sender?.full_name || "Sender",
          }))
        );
      } else {
        setParcels([]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chat</h1>
        <p className="mt-1 text-sm text-gray-600">
          Parcels with matched status — click to open chat
        </p>
      </div>

      {parcels.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <p className="text-gray-500">
            No matched parcels yet. Chat is available when a parcel is matched
            with a courier.
          </p>
          <Link
            href={profile?.role === "sender" ? "/dashboard" : "/dashboard"}
            className="mt-4 inline-block text-primary-600 hover:underline"
            style={{ color: "#29772F" }}
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {parcels.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/parcels/${p.id}`}
              className="block p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile?.role === "sender"
                      ? `Chat with ${p.other_party_name}`
                      : `Chat with ${p.other_party_name}`}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {p.pickup_address?.substring(0, 40)}
                    {p.pickup_address?.length > 40 ? "..." : ""} →{" "}
                    {p.delivery_address?.substring(0, 30)}
                    {p.delivery_address?.length > 30 ? "..." : ""}
                  </p>
                </div>
                <span className="text-primary-600 text-sm font-medium ml-2">
                  Open chat →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
