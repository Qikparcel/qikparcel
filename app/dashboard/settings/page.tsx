"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [connectStatus, setConnectStatus] = useState<{
    hasAccount: boolean;
    onboarded: boolean;
    canReceivePayouts: boolean;
  } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  // Address fields for editing
  const [streetAddress, setStreetAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");

  const [fullNameEdit, setFullNameEdit] = useState("");
  const [emailEdit, setEmailEdit] = useState("");
  const [phoneNumberEdit, setPhoneNumberEdit] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single<Profile>();

        if (profileError) {
          console.error("Error loading profile:", profileError);
          throw profileError;
        }

        setProfile(profileData);

        // Load Connect status for couriers
        if (profileData?.role === "courier") {
          try {
            const res = await fetch("/api/connect/status");
            const data = await res.json();
            if (res.ok) setConnectStatus(data);
          } catch {
            setConnectStatus({
              hasAccount: false,
              onboarded: false,
              canReceivePayouts: false,
            });
          }
        }

        // Initialize address fields
        if (profileData) {
          setStreetAddress(profileData.street_address || "");
          setAddressLine2(profileData.address_line_2 || "");
          setCity(profileData.city || "");
          setState(profileData.state || "");
          setPostcode(profileData.postcode || "");
          setCountry(profileData.country || "");
          setFullNameEdit(profileData.full_name || "");
          setEmailEdit(profileData.email || "");
          setPhoneNumberEdit(profileData.phone_number || "");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (connect === "success" || connect === "refresh") {
      const refetch = async () => {
        try {
          const res = await fetch("/api/connect/status");
          const data = await res.json();
          if (res.ok) setConnectStatus(data);
        } catch {
          /* ignore */
        }
      };
      refetch();
      if (connect === "success")
        toast.success("Stripe account connected. You can now receive payouts.");
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, []);

  const handleEditAddress = () => {
    setIsEditingAddress(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      setStreetAddress(profile.street_address || "");
      setAddressLine2(profile.address_line_2 || "");
      setCity(profile.city || "");
      setState(profile.state || "");
      setPostcode(profile.postcode || "");
      setCountry(profile.country || "");
    }
    setIsEditingAddress(false);
  };

  const handleEditPersonal = () => {
    if (profile) {
      setFullNameEdit(profile.full_name || "");
      setEmailEdit(profile.email || "");
      setPhoneNumberEdit(profile.phone_number || "");
    }
    setIsEditingPersonal(true);
  };

  const handleCancelEditPersonal = () => {
    if (profile) {
      setFullNameEdit(profile.full_name || "");
      setEmailEdit(profile.email || "");
      setPhoneNumberEdit(profile.phone_number || "");
    }
    setIsEditingPersonal(false);
  };

  const handleSavePersonal = async () => {
    if (!profile) return;
    if (!fullNameEdit?.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSavingPersonal(true);
    try {
      const supabase = createSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired. Please log in again.");
        router.push("/login");
        return;
      }
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          fullName: fullNameEdit.trim(),
          email: emailEdit?.trim() || null,
          phoneNumber: phoneNumberEdit?.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update");
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single<Profile>();
      if (updatedProfile) setProfile(updatedProfile);
      setIsEditingPersonal(false);
      toast.success("Personal information updated!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!profile) return;

    // Validate required fields
    if (
      !streetAddress.trim() ||
      !city.trim() ||
      !state.trim() ||
      !postcode.trim() ||
      !country.trim()
    ) {
      toast.error("Please fill in all required address fields");
      return;
    }

    setSaving(true);

    try {
      const supabase = createSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Session expired. Please log in again.");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          streetAddress: streetAddress.trim(),
          addressLine2: addressLine2.trim() || null,
          city: city.trim(),
          state: state.trim(),
          postcode: postcode.trim(),
          country: country.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update address");
      }

      // Reload profile to get updated data
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single<Profile>();

      if (updatedProfile) {
        setProfile(updatedProfile);
      }
      setIsEditingAddress(false);
      toast.success("Address updated successfully!");
    } catch (error: any) {
      console.error("Error updating address:", error);
      toast.error(error.message || "Failed to update address");
    } finally {
      setSaving(false);
    }
  };

  const roleConfig = {
    sender: {
      label: "Sender",
      description: "You can create and manage parcel requests",
      icon: "📦",
      color: "bg-blue-100 text-blue-800",
    },
    courier: {
      label: "Courier",
      description: "You can create trips and deliver parcels",
      icon: "🚚",
      color: "bg-purple-100 text-purple-800",
    },
    admin: {
      label: "Admin",
      description: "You have administrative access",
      icon: "👤",
      color: "bg-green-100 text-green-800",
    },
  };

  const formatAddress = () => {
    if (!profile) return "Not set";

    const parts = [];
    if (profile.street_address) parts.push(profile.street_address);
    if (profile.address_line_2) parts.push(profile.address_line_2);
    if (profile.city) parts.push(profile.city);
    if (profile.state) parts.push(profile.state);
    if (profile.postcode) parts.push(profile.postcode);
    if (profile.country) parts.push(profile.country);

    return parts.length > 0 ? parts.join(", ") : profile.address || "Not set";
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

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Profile not found</p>
          <Link
            href="/dashboard"
            className="text-primary-600 hover:underline mt-4 inline-block"
          >
            Back to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const roleInfo =
    roleConfig[profile.role as keyof typeof roleConfig] || roleConfig.sender;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Settings
          </h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Manage your account information
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Type / Role Card */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              Account Type
            </h2>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-3xl sm:text-4xl">{roleInfo.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${roleInfo.color}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  {roleInfo.description}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Personal Information
              </h2>
              {!isEditingPersonal && (
                <button
                  type="button"
                  onClick={handleEditPersonal}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition"
                  style={{ borderColor: "#29772F", color: "#29772F" }}
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingPersonal ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullNameEdit}
                    onChange={(e) => setFullNameEdit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={emailEdit}
                    onChange={(e) => setEmailEdit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phoneNumber"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumberEdit}
                    onChange={(e) =>
                      setPhoneNumberEdit(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                    placeholder="Phone number"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Updating phone here updates your profile display. Sign-in
                    still uses the number you verified.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSavePersonal}
                    disabled={savingPersonal}
                    className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#29772F" }}
                  >
                    {savingPersonal ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditPersonal}
                    disabled={savingPersonal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Full Name
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.full_name || "Not set"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Phone Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.phone_number || "Not set"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Email Address
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.email || "Not set"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Account Created
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(profile.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Address Information
              </h2>
              {!isEditingAddress && (
                <button
                  onClick={handleEditAddress}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition"
                  style={{ borderColor: "#29772F", color: "#29772F" }}
                >
                  Edit Address
                </button>
              )}
            </div>

            {isEditingAddress ? (
              <div className="space-y-4">
                <AddressAutocomplete
                  label="Address"
                  streetAddress={streetAddress}
                  addressLine2={addressLine2}
                  city={city}
                  state={state}
                  postcode={postcode}
                  country={country}
                  onAddressChange={(fields) => {
                    setStreetAddress(fields.streetAddress);
                    setAddressLine2(fields.addressLine2);
                    setCity(fields.city);
                    setState(fields.state);
                    setPostcode(fields.postcode);
                    setCountry(fields.country);
                  }}
                  required
                  placeholder="Start typing your address..."
                />

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveAddress}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#29772F" }}
                  >
                    {saving ? "Saving..." : "Save Address"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                {profile.street_address || profile.address ? (
                  <>
                    {profile.street_address && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Street Address
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {profile.street_address}
                        </dd>
                      </div>
                    )}

                    {profile.address_line_2 && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Address Line 2
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {profile.address_line_2}
                        </dd>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.city && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            City
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {profile.city}
                          </dd>
                        </div>
                      )}

                      {profile.state && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            State/Province
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {profile.state}
                          </dd>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.postcode && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Postcode
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {profile.postcode}
                          </dd>
                        </div>
                      )}

                      {profile.country && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Country
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {profile.country}
                          </dd>
                        </div>
                      )}
                    </div>

                    {!profile.street_address && profile.address && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Address
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {profile.address}
                        </dd>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      No address information available
                    </p>
                    <button
                      onClick={handleEditAddress}
                      className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition"
                      style={{ borderColor: "#29772F", color: "#29772F" }}
                    >
                      Add Address
                    </button>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Get paid / Stripe Connect (couriers only) */}
          {profile.role === "courier" && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                Get paid
              </h2>
              {connectStatus === null ? (
                <div className="animate-pulse h-10 bg-gray-100 rounded w-48" />
              ) : connectStatus.canReceivePayouts ? (
                <p className="text-sm text-gray-600 mb-2">
                  Your Stripe account is connected. Delivery fees will be paid
                  to you when parcels are marked delivered.
                </p>
              ) : connectStatus.onboarded ? (
                <p className="text-sm text-gray-600 mb-2">
                  Setup complete. Payouts will be enabled once Stripe verifies
                  your account.
                </p>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  Connect a Stripe account to receive delivery fees when you
                  complete deliveries.
                </p>
              )}
              {connectStatus !== null &&
                !connectStatus.canReceivePayouts &&
                !connectStatus.onboarded && (
                  <button
                    type="button"
                    onClick={async () => {
                      setConnectLoading(true);
                      try {
                        const res = await fetch("/api/connect/onboard", {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (!res.ok)
                          throw new Error(
                            data.error || "Failed to start setup"
                          );
                        if (data.url) window.location.href = data.url;
                      } catch (e: any) {
                        toast.error(e.message || "Could not open Stripe setup");
                      } finally {
                        setConnectLoading(false);
                      }
                    }}
                    disabled={connectLoading}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50"
                    style={{ backgroundColor: "#29772F" }}
                  >
                    {connectStatus.hasAccount
                      ? "Complete setup"
                      : "Connect Stripe"}
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
