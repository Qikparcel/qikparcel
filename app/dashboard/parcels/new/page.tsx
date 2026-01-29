"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";

export default function CreateParcelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roleCheckLoading, setRoleCheckLoading] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Pickup address fields
  const [pickupStreetAddress, setPickupStreetAddress] = useState("");
  const [pickupAddressLine2, setPickupAddressLine2] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPostcode, setPickupPostcode] = useState("");
  const [pickupCountry, setPickupCountry] = useState("");

  // Delivery address fields
  const [deliveryStreetAddress, setDeliveryStreetAddress] = useState("");
  const [deliveryAddressLine2, setDeliveryAddressLine2] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryPostcode, setDeliveryPostcode] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("");

  // Coordinate state
  const [pickupCoordinates, setPickupCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{latitude: number, longitude: number} | null>(null);

  // Other fields
  const [formData, setFormData] = useState({
    description: "",
    weight_kg: "",
    dimensions: "",
    estimated_value: "",
    estimated_value_currency: "USD",
    preferred_pickup_time: "",
  });

  // Verify user role on mount
  useEffect(() => {
    async function checkRole() {
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

      if (!profile || profile.role !== "sender") {
        toast.error("Only senders can create parcels");
        router.push("/dashboard");
        return;
      }

      setRoleCheckLoading(false);
    }

    checkRole();
  }, [router]);

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
    // Normalize by trimming, lowercasing, and removing extra spaces
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast.error(
        "Please read and accept the Terms and Conditions to continue"
      );
      return;
    }

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
      toast.error(`Estimated value cannot exceed ${MAX_ESTIMATED_VALUE.toLocaleString()}`);
      return;
    }

    // Verify coordinates are present (required for matching algorithm)
    if (!pickupCoordinates || !pickupCoordinates.latitude || !pickupCoordinates.longitude) {
      toast.error("Please select a pickup address from the suggestions to get coordinates. This is required for matching.");
      return;
    }

    if (!deliveryCoordinates || !deliveryCoordinates.latitude || !deliveryCoordinates.longitude) {
      toast.error("Please select a delivery address from the suggestions to get coordinates. This is required for matching.");
      return;
    }

    // Build address strings
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

    setLoading(true);

    try {
      const response = await fetch("/api/parcels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_address: pickupAddress,
          pickup_latitude: pickupCoordinates?.latitude || null,
          pickup_longitude: pickupCoordinates?.longitude || null,
          delivery_address: deliveryAddress,
          delivery_latitude: deliveryCoordinates?.latitude || null,
          delivery_longitude: deliveryCoordinates?.longitude || null,
          description: formData.description.trim() || null,
          weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
          dimensions: formData.dimensions.trim(),
          estimated_value: parseFloat(formData.estimated_value),
          estimated_value_currency: formData.estimated_value_currency,
          preferred_pickup_time: formData.preferred_pickup_time || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to create parcel"
        );
      }

      toast.success("Parcel created successfully!");
      router.push(`/dashboard/parcels/${data.parcel.id}`);
    } catch (error: any) {
      console.error("Error creating parcel:", error);
      toast.error(error.message || "Failed to create parcel");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (roleCheckLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Parcel
          </h1>
          <p className="mt-2 text-gray-600">
            Fill in the details to create a parcel request
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-6 space-y-8"
        >
          {/* Pickup Address */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Pickup Address
              </h2>
              {pickupCoordinates?.latitude && pickupCoordinates?.longitude ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✅ Coordinates: {pickupCoordinates.latitude.toFixed(6)}, {pickupCoordinates.longitude.toFixed(6)}
                </span>
              ) : (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  ⚠️ Select address from suggestions for coordinates
                </span>
              )}
            </div>

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
                // Capture coordinates - only update if provided, preserve existing if not
                if (fields.coordinates) {
                  setPickupCoordinates(fields.coordinates);
                }
                // Don't set to null if not provided - preserve existing coordinates
              }}
              required
              placeholder="Start typing pickup address..."
            />
          </div>

          {/* Delivery Address */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Delivery Address
              </h2>
              {deliveryCoordinates?.latitude && deliveryCoordinates?.longitude ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✅ Coordinates: {deliveryCoordinates.latitude.toFixed(6)}, {deliveryCoordinates.longitude.toFixed(6)}
                </span>
              ) : (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  ⚠️ Select address from suggestions for coordinates
                </span>
              )}
            </div>

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
                // Capture coordinates - only update if provided, preserve existing if not
                if (fields.coordinates) {
                  setDeliveryCoordinates(fields.coordinates);
                }
                // Don't set to null if not provided - preserve existing coordinates
              }}
              required
              placeholder="Start typing delivery address..."
            />
          </div>

          {/* Parcel Details */}
          <div className="space-y-4 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Parcel Details
            </h2>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description <span className="text-gray-500 font-normal">(e.g., goods box, electronics, documents)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g., goods box, electronics, documents, clothing, etc."
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
                  onChange={handleChange}
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
                  onChange={handleChange}
                  placeholder="e.g., 30x20x15 cm"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="preferred_pickup_time"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Preferred Pickup Time (Optional)
              </label>
              <input
                type="datetime-local"
                id="preferred_pickup_time"
                name="preferred_pickup_time"
                value={formData.preferred_pickup_time}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
              <p className="mt-1 text-sm text-gray-500">
                When would you like the courier to pick up your parcel?
              </p>
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
                  onChange={handleChange}
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

          {/* Terms and Conditions */}
          <div className="border-t pt-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                style={{ accentColor: "#29772F" }}
                required
              />
              <label
                htmlFor="acceptTerms"
                className="text-sm text-gray-700 flex-1"
              >
                I have read and agree to the{" "}
                <Link
                  href="/terms/general"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: "#29772F" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                {", "}
                <Link
                  href="/terms/sender"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: "#29772F" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Sender Terms and Conditions
                </Link>{" "}
                and the{" "}
                <Link
                  href="/terms/prohibited-items"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: "#29772F" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Prohibited Items Schedule
                </Link>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#29772F" }}
            >
              {loading ? "Creating..." : "Create Parcel"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
