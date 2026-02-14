"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import ParcelTimeline from "@/components/ParcelTimeline";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type StatusHistory =
  Database["public"]["Tables"]["parcel_status_history"]["Row"];

type MatchedCourier = {
  full_name: string | null;
  phone_number: string;
  whatsapp_number: string | null;
};

type PaymentInfo = {
  total_amount: number;
  currency: string;
  payment_status: string;
  delivery_confirmed_by_sender_at?: string | null;
};

export default function ParcelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const parcelId = params.id as string;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [matchedCourier, setMatchedCourier] = useState<MatchedCourier | null>(
    null
  );
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form fields
  const [pickupStreetAddress, setPickupStreetAddress] = useState("");
  const [pickupAddressLine2, setPickupAddressLine2] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPostcode, setPickupPostcode] = useState("");
  const [pickupCountry, setPickupCountry] = useState("");

  const [deliveryStreetAddress, setDeliveryStreetAddress] = useState("");
  const [deliveryAddressLine2, setDeliveryAddressLine2] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryPostcode, setDeliveryPostcode] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("");

  const [formData, setFormData] = useState({
    description: "",
    weight_kg: "",
    dimensions: "",
    estimated_value: "",
    estimated_value_currency: "USD",
  });

  useEffect(() => {
    async function loadParcel() {
      try {
        const response = await fetch(`/api/parcels/${parcelId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load parcel");
        }

        setParcel(data.parcel);
        setStatusHistory(data.statusHistory || []);
        setMatchedCourier(data.matchedCourier ?? null);
        setPaymentInfo(data.paymentInfo ?? null);

        // Initialize form fields with existing data
        if (data.parcel) {
          setFormData({
            description: data.parcel.description || "",
            weight_kg: data.parcel.weight_kg?.toString() || "",
            dimensions: data.parcel.dimensions || "",
            estimated_value: data.parcel.estimated_value?.toString() || "",
            estimated_value_currency:
              (data.parcel as any).estimated_value_currency || "USD",
          });
        }

        // Matches are only shown on courier side (trip detail page), not on sender side
      } catch (error: any) {
        console.error("Error loading parcel:", error);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    if (parcelId) {
      loadParcel();
    }
  }, [parcelId, router]);

  // Handle payment success/cancel redirect (webhook updates payment_status; we just reload and clear URL)
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success("Payment completed successfully!");
      fetch(`/api/parcels/${parcelId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.paymentInfo) setPaymentInfo(d.paymentInfo);
        });
      router.replace(`/dashboard/parcels/${parcelId}`, { scroll: false });
    } else if (payment === "cancelled") {
      toast.error("Payment was cancelled");
      router.replace(`/dashboard/parcels/${parcelId}`, { scroll: false });
    }
  }, [searchParams, parcelId, router]);

  async function handlePay() {
    if (!parcelId || paying) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcel_id: parcelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout");
      if (data.url) window.location.href = data.url;
      else toast.error("No payment URL received");
    } catch (err: any) {
      toast.error(err.message || "Failed to start payment");
    } finally {
      setPaying(false);
    }
  }

  // Helper function to parse address string into components
  const parseAddressString = (addressString: string) => {
    if (!addressString) {
      return {
        streetAddress: "",
        addressLine2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      };
    }

    // Split by comma and trim each part
    const parts = addressString
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    // Simple parsing logic:
    // Format is typically: "Street, Line2, City, State, Postcode, Country"
    // But it could have fewer or more parts
    if (parts.length === 0) {
      return {
        streetAddress: addressString,
        addressLine2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      };
    }

    // Try to identify country (usually last part)
    let country = "";
    let postcode = "";
    let state = "";
    let city = "";
    let line2 = "";
    let street = "";

    // If we have at least 2 parts, last one might be country
    if (parts.length >= 2) {
      country = parts[parts.length - 1];
    }

    // If we have at least 3 parts, second-to-last might be postcode
    if (parts.length >= 3) {
      postcode = parts[parts.length - 2];
    }

    // If we have at least 4 parts, third-to-last might be state
    if (parts.length >= 4) {
      state = parts[parts.length - 3];
    }

    // If we have at least 5 parts, fourth-to-last might be city
    if (parts.length >= 5) {
      city = parts[parts.length - 4];
    }

    // If we have at least 6 parts, fifth-to-last might be line2
    if (parts.length >= 6) {
      line2 = parts[parts.length - 5];
      street = parts.slice(0, parts.length - 5).join(", ");
    } else if (parts.length >= 5) {
      street = parts[0];
      line2 = parts[1];
    } else if (parts.length >= 4) {
      street = parts[0];
      line2 = "";
    } else if (parts.length >= 3) {
      street = parts[0];
    } else if (parts.length >= 2) {
      street = parts[0];
      line2 = parts[1];
    } else {
      street = parts[0];
    }

    return {
      streetAddress: street,
      addressLine2: line2,
      city,
      state,
      postcode,
      country,
    };
  };

  const handleEdit = () => {
    if (!parcel) return;

    // Parse and initialize address fields from existing parcel data
    const pickupParsed = parseAddressString(parcel.pickup_address || "");
    setPickupStreetAddress(pickupParsed.streetAddress);
    setPickupAddressLine2(pickupParsed.addressLine2);
    setPickupCity(pickupParsed.city);
    setPickupState(pickupParsed.state);
    setPickupPostcode(pickupParsed.postcode);
    setPickupCountry(pickupParsed.country);

    const deliveryParsed = parseAddressString(parcel.delivery_address || "");
    setDeliveryStreetAddress(deliveryParsed.streetAddress);
    setDeliveryAddressLine2(deliveryParsed.addressLine2);
    setDeliveryCity(deliveryParsed.city);
    setDeliveryState(deliveryParsed.state);
    setDeliveryPostcode(deliveryParsed.postcode);
    setDeliveryCountry(deliveryParsed.country);

    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form fields to original values
    if (parcel) {
      setFormData({
        description: parcel.description || "",
        weight_kg: parcel.weight_kg?.toString() || "",
        dimensions: parcel.dimensions || "",
        estimated_value: parcel.estimated_value?.toString() || "",
        estimated_value_currency:
          (parcel as any).estimated_value_currency || "USD",
      });
    }
    // Reset address fields (they'll need to be set via AddressAutocomplete)
    setPickupStreetAddress("");
    setPickupAddressLine2("");
    setPickupCity("");
    setPickupState("");
    setPickupPostcode("");
    setPickupCountry("");
    setDeliveryStreetAddress("");
    setDeliveryAddressLine2("");
    setDeliveryCity("");
    setDeliveryState("");
    setDeliveryPostcode("");
    setDeliveryCountry("");
  };

  const buildAddressString = (
    street: string,
    line2: string,
    city: string,
    state: string,
    postcode: string,
    country: string
  ): string => {
    const parts = [];
    if (street) parts.push(street);
    if (line2) parts.push(line2);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (postcode) parts.push(postcode);
    if (country) parts.push(country);
    return parts.join(", ");
  };

  const normalizeAddress = (
    street: string,
    line2: string,
    city: string,
    state: string,
    postcode: string,
    country: string
  ): string => {
    const parts = [
      street.trim().toLowerCase(),
      line2.trim().toLowerCase(),
      city.trim().toLowerCase(),
      state.trim().toLowerCase(),
      postcode.trim().toLowerCase(),
      country.trim().toLowerCase(),
    ].filter((part) => part.length > 0);
    return parts.join(" ").replace(/\s+/g, " ");
  };

  const areAddressesSame = (
    street1: string,
    line2_1: string,
    city1: string,
    state1: string,
    postcode1: string,
    country1: string,
    street2: string,
    line2_2: string,
    city2: string,
    state2: string,
    postcode2: string,
    country2: string
  ): boolean => {
    const normalized1 = normalizeAddress(
      street1,
      line2_1,
      city1,
      state1,
      postcode1,
      country1
    );
    const normalized2 = normalizeAddress(
      street2,
      line2_2,
      city2,
      state2,
      postcode2,
      country2
    );
    return normalized1 === normalized2;
  };

  const handleSave = async () => {
    if (!parcel) return;

    // Validate required address fields
    if (
      !pickupStreetAddress.trim() ||
      !pickupCity.trim() ||
      !pickupState.trim() ||
      !pickupPostcode.trim() ||
      !pickupCountry.trim()
    ) {
      toast.error("Please fill in all required pickup address fields");
      return;
    }

    if (
      !deliveryStreetAddress.trim() ||
      !deliveryCity.trim() ||
      !deliveryState.trim() ||
      !deliveryPostcode.trim() ||
      !deliveryCountry.trim()
    ) {
      toast.error("Please fill in all required delivery address fields");
      return;
    }

    // Check if pickup and delivery addresses are the same
    if (
      areAddressesSame(
        pickupStreetAddress,
        pickupAddressLine2,
        pickupCity,
        pickupState,
        pickupPostcode,
        pickupCountry,
        deliveryStreetAddress,
        deliveryAddressLine2,
        deliveryCity,
        deliveryState,
        deliveryPostcode,
        deliveryCountry
      )
    ) {
      toast.error("Pickup and delivery addresses cannot be the same");
      return;
    }

    if (!formData.dimensions.trim()) {
      toast.error("Dimensions are required");
      return;
    }

    if (!formData.estimated_value.trim()) {
      toast.error("Estimated value is required");
      return;
    }
    const valueNum = parseFloat(formData.estimated_value);
    if (Number.isNaN(valueNum) || valueNum < 0) {
      toast.error("Estimated value must be a valid number (0 or more)");
      return;
    }
    const MAX_ESTIMATED_VALUE = 2000;
    if (valueNum > MAX_ESTIMATED_VALUE) {
      toast.error(
        `Estimated value cannot exceed ${MAX_ESTIMATED_VALUE.toLocaleString()}`
      );
      return;
    }

    setSaving(true);

    try {
      const pickupAddress = buildAddressString(
        pickupStreetAddress,
        pickupAddressLine2,
        pickupCity,
        pickupState,
        pickupPostcode,
        pickupCountry
      );

      const deliveryAddress = buildAddressString(
        deliveryStreetAddress,
        deliveryAddressLine2,
        deliveryCity,
        deliveryState,
        deliveryPostcode,
        deliveryCountry
      );

      const response = await fetch(`/api/parcels/${parcelId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          description: formData.description.trim() || null,
          weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
          dimensions: formData.dimensions.trim(),
          estimated_value: parseFloat(formData.estimated_value),
          estimated_value_currency: formData.estimated_value_currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update parcel");
      }

      // Reload parcel data
      const reloadResponse = await fetch(`/api/parcels/${parcelId}`);
      const reloadData = await reloadResponse.json();
      if (reloadResponse.ok) {
        setParcel(reloadData.parcel);
        setStatusHistory(reloadData.statusHistory || []);
      }

      setIsEditing(false);
      toast.success("Parcel updated successfully!");
    } catch (error: any) {
      console.error("Error updating parcel:", error);
      toast.error(error.message || "Failed to update parcel");
    } finally {
      setSaving(false);
    }
  };

  const statusConfig: Record<
    Parcel["status"],
    { label: string; color: string }
  > = {
    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
    matched: { label: "Matched", color: "bg-blue-100 text-blue-800" },
    picked_up: { label: "Picked Up", color: "bg-purple-100 text-purple-800" },
    in_transit: { label: "In Transit", color: "bg-indigo-100 text-indigo-800" },
    delivered: { label: "Delivered", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
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

  if (!parcel) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Parcel not found</p>
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrencySymbol = (currency: string | null | undefined) => {
    switch (currency) {
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      default:
        return "$"; // Default to USD
    }
  };

  const formatCurrency = (
    value: number | null,
    currency: string | null | undefined
  ) => {
    if (!value) return null;
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${value.toFixed(2)}`;
  };

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
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Parcel Details</h1>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  statusConfig[parcel.status].color
                }`}
              >
                {statusConfig[parcel.status].label}
              </span>
              {!isEditing && parcel.status === "pending" && (
                <>
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition"
                    style={{ borderColor: "#29772F", color: "#29772F" }}
                  >
                    Edit Parcel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Delete this parcel? This cannot be undone."
                        )
                      )
                        return;
                      setDeleting(true);
                      fetch(`/api/parcels/${parcelId}`, { method: "DELETE" })
                        .then(async (res) => {
                          const data = await res.json();
                          if (res.ok) {
                            toast.success("Parcel deleted");
                            router.push("/dashboard");
                          } else {
                            toast.error(data.error || "Failed to delete");
                          }
                        })
                        .catch(() => toast.error("Failed to delete parcel"))
                        .finally(() => setDeleting(false));
                    }}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {isEditing ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Edit Parcel
                </h2>

                <form className="space-y-6">
                  {/* Pickup Address */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                      Pickup Address
                    </h3>
                    <AddressAutocomplete
                      label="Pickup Address"
                      streetAddress={pickupStreetAddress}
                      addressLine2={pickupAddressLine2}
                      city={pickupCity}
                      state={pickupState}
                      postcode={pickupPostcode}
                      country={pickupCountry}
                      onAddressChange={(fields) => {
                        setPickupStreetAddress(fields.streetAddress);
                        setPickupAddressLine2(fields.addressLine2);
                        setPickupCity(fields.city);
                        setPickupState(fields.state);
                        setPickupPostcode(fields.postcode);
                        setPickupCountry(fields.country);
                      }}
                      required
                      placeholder="Start typing pickup address..."
                    />
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                      Delivery Address
                    </h3>
                    <AddressAutocomplete
                      label="Delivery Address"
                      streetAddress={deliveryStreetAddress}
                      addressLine2={deliveryAddressLine2}
                      city={deliveryCity}
                      state={deliveryState}
                      postcode={deliveryPostcode}
                      country={deliveryCountry}
                      onAddressChange={(fields) => {
                        setDeliveryStreetAddress(fields.streetAddress);
                        setDeliveryAddressLine2(fields.addressLine2);
                        setDeliveryCity(fields.city);
                        setDeliveryState(fields.state);
                        setDeliveryPostcode(fields.postcode);
                        setDeliveryCountry(fields.country);
                      }}
                      required
                      placeholder="Start typing delivery address..."
                    />
                  </div>

                  {/* Parcel Details */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Parcel Details
                    </h3>

                    <div>
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describe what you're sending (optional)"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="weight_kg"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          id="weight_kg"
                          name="weight_kg"
                          value={formData.weight_kg}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              weight_kg: e.target.value,
                            })
                          }
                          placeholder="0.0"
                          step="0.1"
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="dimensions"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Dimensions <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="dimensions"
                          name="dimensions"
                          value={formData.dimensions}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              dimensions: e.target.value,
                            })
                          }
                          placeholder="e.g., 30x20x15 cm"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="estimated_value"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Estimated Value <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          id="estimated_value"
                          name="estimated_value"
                          value={formData.estimated_value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              estimated_value: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          max="2000"
                          required
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                        />
                        <select
                          id="estimated_value_currency"
                          name="estimated_value_currency"
                          value={formData.estimated_value_currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              estimated_value_currency: e.target.value,
                            })
                          }
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black bg-white"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "#29772F" }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Parcel Information
                </h2>

                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Pickup Address
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {parcel.pickup_address}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Delivery Address
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {parcel.delivery_address}
                    </dd>
                  </div>

                  {parcel.description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Description
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {parcel.description}
                      </dd>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {parcel.weight_kg && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Weight
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {parcel.weight_kg} kg
                        </dd>
                      </div>
                    )}

                    {parcel.dimensions && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Dimensions
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {parcel.dimensions}
                        </dd>
                      </div>
                    )}
                  </div>

                  {parcel.estimated_value && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Estimated Value
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatCurrency(
                          parcel.estimated_value,
                          (parcel as any).estimated_value_currency
                        )}
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Created At
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(parcel.created_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Timeline - Only show when not editing */}
            {!isEditing && (
              <ParcelTimeline
                statusHistory={statusHistory}
                currentStatus={parcel.status}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment — show Pay button when matched and payment pending */}
            {paymentInfo && paymentInfo.payment_status === "pending" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Payment
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  Total:{" "}
                  <strong>
                    {paymentInfo.currency} {paymentInfo.total_amount.toFixed(2)}
                  </strong>
                </p>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                  style={{ backgroundColor: "#29772F" }}
                >
                  {paying ? "Redirecting..." : "Pay now"}
                </button>
              </div>
            )}

            {paymentInfo && paymentInfo.payment_status === "paid" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  Payment
                </h2>
                <p className="text-sm text-green-600 font-medium">Paid</p>
              </div>
            )}

            {/* Sender confirms delivery — triggers courier payout */}
            {parcel.status === "delivered" && paymentInfo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  Delivery
                </h2>
                {paymentInfo.delivery_confirmed_by_sender_at ? (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Delivery confirmed. The courier will receive their
                    payment.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-3">
                      Has your parcel been delivered? Confirm to release payment
                      to the courier.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmingDelivery(true);
                        try {
                          const res = await fetch(
                            `/api/parcels/${parcelId}/confirm-delivery`,
                            { method: "POST" }
                          );
                          const data = await res.json();
                          if (!res.ok)
                            throw new Error(data.error || "Failed to confirm");
                          toast.success(data.message || "Delivery confirmed.");
                          const reload = await fetch(
                            `/api/parcels/${parcelId}`
                          );
                          const reloadData = await reload.json();
                          if (reloadData.paymentInfo)
                            setPaymentInfo(reloadData.paymentInfo);
                        } catch (e: any) {
                          toast.error(
                            e.message || "Could not confirm delivery"
                          );
                        } finally {
                          setConfirmingDelivery(false);
                        }
                      }}
                      disabled={confirmingDelivery}
                      className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                      style={{ backgroundColor: "#29772F" }}
                    >
                      {confirmingDelivery ? "Confirming…" : "Confirm delivery"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Courier (person) info — shown to sender when parcel is matched */}
            {parcel.status !== "pending" &&
              parcel.status !== "cancelled" &&
              matchedCourier && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    Your courier
                  </h2>
                  <dl className="space-y-3">
                    {matchedCourier.full_name && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Name
                        </dt>
                        <dd className="mt-0.5 text-sm text-gray-900">
                          {matchedCourier.full_name}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Phone
                      </dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        <a
                          href={`tel:${matchedCourier.phone_number}`}
                          className="text-primary-600 hover:underline"
                          style={{ color: "#29772F" }}
                        >
                          {matchedCourier.phone_number}
                        </a>
                      </dd>
                    </div>
                    {matchedCourier.whatsapp_number && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          WhatsApp
                        </dt>
                        <dd className="mt-0.5 text-sm text-gray-900">
                          <a
                            href={`https://wa.me/${matchedCourier.whatsapp_number.replace(
                              /\D/g,
                              ""
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                            style={{ color: "#29772F" }}
                          >
                            {matchedCourier.whatsapp_number}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link
                  href="/dashboard/parcels/new"
                  className="block w-full px-4 py-2 text-center bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  style={{ backgroundColor: "#29772F" }}
                >
                  Create New Parcel
                </Link>
                <Link
                  href="/dashboard"
                  className="block w-full px-4 py-2 text-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  View All Parcels
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
