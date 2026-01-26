"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";

export default function CreateTripPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roleCheckLoading, setRoleCheckLoading] = useState(true);

  // Origin address fields
  const [originStreetAddress, setOriginStreetAddress] = useState("");
  const [originAddressLine2, setOriginAddressLine2] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originState, setOriginState] = useState("");
  const [originPostcode, setOriginPostcode] = useState("");
  const [originCountry, setOriginCountry] = useState("");

  // Destination address fields
  const [destinationStreetAddress, setDestinationStreetAddress] = useState("");
  const [destinationAddressLine2, setDestinationAddressLine2] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationState, setDestinationState] = useState("");
  const [destinationPostcode, setDestinationPostcode] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");

  // Coordinate state
  const [originCoordinates, setOriginCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState<{latitude: number, longitude: number} | null>(null);

  // Other fields
  const [departureTime, setDepartureTime] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [availableCapacity, setAvailableCapacity] = useState("");

  // Get minimum datetime for departure (current local time)
  const getMinDepartureTime = (): string => {
    const now = new Date();
    // Format as YYYY-MM-DDTHH:mm for datetime-local input (local timezone)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get minimum datetime for estimated arrival (either departure time or now)
  const getMinArrivalTime = (): string => {
    if (departureTime) {
      // Parse departure time as local time and add 1 minute
      const departureDate = new Date(departureTime);
      departureDate.setMinutes(departureDate.getMinutes() + 1);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input (local timezone)
      const year = departureDate.getFullYear();
      const month = String(departureDate.getMonth() + 1).padStart(2, "0");
      const day = String(departureDate.getDate()).padStart(2, "0");
      const hours = String(departureDate.getHours()).padStart(2, "0");
      const minutes = String(departureDate.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return getMinDepartureTime();
  };

  // Convert local datetime string to UTC ISO string
  const convertLocalToUTC = (localDateTime: string): string | null => {
    if (!localDateTime) return null;
    // datetime-local input gives us a string like "2024-01-15T14:30"
    // We need to treat this as local time and convert to UTC
    const localDate = new Date(localDateTime);
    // Check if date is valid
    if (isNaN(localDate.getTime())) return null;
    return localDate.toISOString();
  };

  // Reset estimated arrival if it becomes invalid when departure time changes
  useEffect(() => {
    if (departureTime && estimatedArrival) {
      const departureDate = new Date(departureTime);
      const arrivalDate = new Date(estimatedArrival);
      if (arrivalDate <= departureDate) {
        setEstimatedArrival("");
      }
    }
  }, [departureTime, estimatedArrival]);

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

      if (!profile || profile?.role !== "courier") {
        toast.error("Only couriers can create trips");
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
    setLoading(true);

    try {
      // Validate required address fields
      if (
        !originStreetAddress.trim() ||
        !originCity.trim() ||
        !originState.trim() ||
        !originPostcode.trim() ||
        !originCountry.trim()
      ) {
        toast.error("Please fill in all required origin address fields");
        setLoading(false);
        return;
      }

      if (
        !destinationStreetAddress.trim() ||
        !destinationCity.trim() ||
        !destinationState.trim() ||
        !destinationPostcode.trim() ||
        !destinationCountry.trim()
      ) {
        toast.error("Please fill in all required destination address fields");
        setLoading(false);
        return;
      }

      // Check if origin and destination addresses are the same
      if (
        areAddressesSame(
          originStreetAddress,
          originAddressLine2,
          originCity,
          originState,
          originPostcode,
          originCountry,
          destinationStreetAddress,
          destinationAddressLine2,
          destinationCity,
          destinationState,
          destinationPostcode,
          destinationCountry
        )
      ) {
        toast.error("Origin and destination addresses cannot be the same");
        setLoading(false);
        return;
      }

      // Validate that both dates are provided (mandatory fields)
      if (!departureTime || !departureTime.trim()) {
        toast.error("Departure time is required");
        setLoading(false);
        return;
      }

      if (!estimatedArrival || !estimatedArrival.trim()) {
        toast.error("Estimated arrival is required");
        setLoading(false);
        return;
      }

      // Validate dates are not in the past (using local timezone)
      const now = new Date();
      now.setSeconds(0, 0); // Reset seconds and milliseconds for comparison

      // Parse as local time (datetime-local input is in local timezone)
      const departureDate = new Date(departureTime);
      if (isNaN(departureDate.getTime())) {
        toast.error("Invalid departure time");
        setLoading(false);
        return;
      }
      if (departureDate < now) {
        toast.error("Departure time cannot be in the past");
        setLoading(false);
        return;
      }

      // Parse as local time (datetime-local input is in local timezone)
      const arrivalDate = new Date(estimatedArrival);
      if (isNaN(arrivalDate.getTime())) {
        toast.error("Invalid estimated arrival time");
        setLoading(false);
        return;
      }
      if (arrivalDate < now) {
        toast.error("Estimated arrival cannot be in the past");
        setLoading(false);
        return;
      }

      // Ensure arrival is after departure
      if (arrivalDate <= departureDate) {
        toast.error("Estimated arrival must be after departure time");
        setLoading(false);
        return;
      }

      // Build address strings
      const originAddress = buildAddressString(
        originStreetAddress,
        originAddressLine2,
        originCity,
        originState,
        originPostcode,
        originCountry
      );

      const destinationAddress = buildAddressString(
        destinationStreetAddress,
        destinationAddressLine2,
        destinationCity,
        destinationState,
        destinationPostcode,
        destinationCountry
      );

      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin_address: originAddress,
          origin_latitude: originCoordinates?.latitude || null,
          origin_longitude: originCoordinates?.longitude || null,
          destination_address: destinationAddress,
          destination_latitude: destinationCoordinates?.latitude || null,
          destination_longitude: destinationCoordinates?.longitude || null,
          // Convert local datetime to UTC before sending (both are required)
          departure_time: convertLocalToUTC(departureTime)!,
          estimated_arrival: convertLocalToUTC(estimatedArrival)!,
          available_capacity: availableCapacity || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to create trip");
      }

      toast.success("Trip created successfully!");
      router.push(`/dashboard/trips/${data.trip.id}`);
    } catch (error: any) {
      console.error("Error creating trip:", error);
      toast.error(error.message || "Failed to create trip");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Create New Trip</h1>
          <p className="mt-2 text-gray-600">
            Fill in the details to create a trip route
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-6 space-y-8"
        >
          {/* Origin Address */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Origin Address
            </h2>

            <AddressAutocomplete
              label="Origin Address"
              streetAddress={originStreetAddress}
              addressLine2={originAddressLine2}
              city={originCity}
              state={originState}
              postcode={originPostcode}
              country={originCountry}
              onAddressChange={(fields) => {
                setOriginStreetAddress(fields.streetAddress);
                setOriginAddressLine2(fields.addressLine2);
                setOriginCity(fields.city);
                setOriginState(fields.state);
                setOriginPostcode(fields.postcode);
                setOriginCountry(fields.country);
                // Capture coordinates - only update if provided, preserve existing if not
                if (fields.coordinates) {
                  setOriginCoordinates(fields.coordinates);
                }
                // Don't set to null if not provided - preserve existing coordinates
              }}
              required
              placeholder="Start typing origin address..."
            />
          </div>

          {/* Destination Address */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Destination Address
            </h2>

            <AddressAutocomplete
              label="Destination Address"
              streetAddress={destinationStreetAddress}
              addressLine2={destinationAddressLine2}
              city={destinationCity}
              state={destinationState}
              postcode={destinationPostcode}
              country={destinationCountry}
              onAddressChange={(fields) => {
                setDestinationStreetAddress(fields.streetAddress);
                setDestinationAddressLine2(fields.addressLine2);
                setDestinationCity(fields.city);
                setDestinationState(fields.state);
                setDestinationPostcode(fields.postcode);
                setDestinationCountry(fields.country);
                // Capture coordinates - only update if provided, preserve existing if not
                if (fields.coordinates) {
                  setDestinationCoordinates(fields.coordinates);
                }
                // Don't set to null if not provided - preserve existing coordinates
              }}
              required
              placeholder="Start typing destination address..."
            />
          </div>

          {/* Trip Details */}
          <div className="space-y-4 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Trip Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="departure_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Departure Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="departure_time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  min={getMinDepartureTime()}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label
                  htmlFor="estimated_arrival"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Estimated Arrival <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="estimated_arrival"
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                  min={getMinArrivalTime()}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="available_capacity"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Available Capacity
              </label>
              <select
                id="available_capacity"
                value={availableCapacity}
                onChange={(e) => setAvailableCapacity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              >
                <option value="">Select capacity</option>
                <option value="small">Small (upto 3kg)</option>
                <option value="medium">Medium (upto 5kg)</option>
                <option value="large">Large (upto 10kg)</option>
              </select>
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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#29772F" }}
            >
              {loading ? "Creating..." : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
