'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/DashboardLayout'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Database } from '@/types/database'

type Trip = Database['public']['Tables']['trips']['Row']

export default function TripDetailPage() {
  const router = useRouter()
  const params = useParams()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form fields
  const [originStreetAddress, setOriginStreetAddress] = useState("")
  const [originAddressLine2, setOriginAddressLine2] = useState("")
  const [originCity, setOriginCity] = useState("")
  const [originState, setOriginState] = useState("")
  const [originPostcode, setOriginPostcode] = useState("")
  const [originCountry, setOriginCountry] = useState("")

  const [destinationStreetAddress, setDestinationStreetAddress] = useState("")
  const [destinationAddressLine2, setDestinationAddressLine2] = useState("")
  const [destinationCity, setDestinationCity] = useState("")
  const [destinationState, setDestinationState] = useState("")
  const [destinationPostcode, setDestinationPostcode] = useState("")
  const [destinationCountry, setDestinationCountry] = useState("")

  const [departureTime, setDepartureTime] = useState("")
  const [estimatedArrival, setEstimatedArrival] = useState("")
  const [availableCapacity, setAvailableCapacity] = useState("")

  useEffect(() => {
    async function loadTrip() {
      try {
        const response = await fetch(`/api/trips/${tripId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load trip')
        }

        setTrip(data.trip)
        
        // Initialize form fields with existing data
        if (data.trip) {
          setAvailableCapacity(data.trip.available_capacity || "")
          
          // Convert UTC dates to local datetime-local format
          if (data.trip.departure_time) {
            const depDate = new Date(data.trip.departure_time)
            const year = depDate.getFullYear()
            const month = String(depDate.getMonth() + 1).padStart(2, "0")
            const day = String(depDate.getDate()).padStart(2, "0")
            const hours = String(depDate.getHours()).padStart(2, "0")
            const minutes = String(depDate.getMinutes()).padStart(2, "0")
            setDepartureTime(`${year}-${month}-${day}T${hours}:${minutes}`)
          }
          
          if (data.trip.estimated_arrival) {
            const arrDate = new Date(data.trip.estimated_arrival)
            const year = arrDate.getFullYear()
            const month = String(arrDate.getMonth() + 1).padStart(2, "0")
            const day = String(arrDate.getDate()).padStart(2, "0")
            const hours = String(arrDate.getHours()).padStart(2, "0")
            const minutes = String(arrDate.getMinutes()).padStart(2, "0")
            setEstimatedArrival(`${year}-${month}-${day}T${hours}:${minutes}`)
          }
        }
      } catch (error: any) {
        console.error('Error loading trip:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    if (tripId) {
      loadTrip()
    }
  }, [tripId, router])

  // Get minimum datetime for departure (current local time)
  const getMinDepartureTime = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Get minimum datetime for estimated arrival
  const getMinArrivalTime = (): string => {
    if (departureTime) {
      const departureDate = new Date(departureTime)
      departureDate.setMinutes(departureDate.getMinutes() + 1)
      const year = departureDate.getFullYear()
      const month = String(departureDate.getMonth() + 1).padStart(2, "0")
      const day = String(departureDate.getDate()).padStart(2, "0")
      const hours = String(departureDate.getHours()).padStart(2, "0")
      const minutes = String(departureDate.getMinutes()).padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    return getMinDepartureTime()
  }

  // Convert local datetime string to UTC ISO string
  const convertLocalToUTC = (localDateTime: string): string | null => {
    if (!localDateTime) return null
    const localDate = new Date(localDateTime)
    if (isNaN(localDate.getTime())) return null
    return localDate.toISOString()
  }

  useEffect(() => {
    if (departureTime && estimatedArrival) {
      const departureDate = new Date(departureTime)
      const arrivalDate = new Date(estimatedArrival)
      if (arrivalDate <= departureDate) {
        setEstimatedArrival("")
      }
    }
  }, [departureTime])

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
      }
    }

    // Split by comma and trim each part
    const parts = addressString.split(",").map((part) => part.trim()).filter(Boolean)

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
      }
    }

    // Try to identify country (usually last part)
    let country = ""
    let postcode = ""
    let state = ""
    let city = ""
    let line2 = ""
    let street = ""

    // If we have at least 2 parts, last one might be country
    if (parts.length >= 2) {
      country = parts[parts.length - 1]
    }

    // If we have at least 3 parts, second-to-last might be postcode
    if (parts.length >= 3) {
      postcode = parts[parts.length - 2]
    }

    // If we have at least 4 parts, third-to-last might be state
    if (parts.length >= 4) {
      state = parts[parts.length - 3]
    }

    // If we have at least 5 parts, fourth-to-last might be city
    if (parts.length >= 5) {
      city = parts[parts.length - 4]
    }

    // If we have at least 6 parts, fifth-to-last might be line2
    if (parts.length >= 6) {
      line2 = parts[parts.length - 5]
      street = parts.slice(0, parts.length - 5).join(", ")
    } else if (parts.length >= 5) {
      street = parts[0]
      line2 = parts[1]
    } else if (parts.length >= 4) {
      street = parts[0]
      line2 = ""
    } else if (parts.length >= 3) {
      street = parts[0]
    } else if (parts.length >= 2) {
      street = parts[0]
      line2 = parts[1]
    } else {
      street = parts[0]
    }

    return {
      streetAddress: street,
      addressLine2: line2,
      city,
      state,
      postcode,
      country,
    }
  }

  const handleEdit = () => {
    if (!trip) return
    
    // Parse and initialize address fields from existing trip data
    const originParsed = parseAddressString(trip.origin_address || "")
    setOriginStreetAddress(originParsed.streetAddress)
    setOriginAddressLine2(originParsed.addressLine2)
    setOriginCity(originParsed.city)
    setOriginState(originParsed.state)
    setOriginPostcode(originParsed.postcode)
    setOriginCountry(originParsed.country)

    const destinationParsed = parseAddressString(trip.destination_address || "")
    setDestinationStreetAddress(destinationParsed.streetAddress)
    setDestinationAddressLine2(destinationParsed.addressLine2)
    setDestinationCity(destinationParsed.city)
    setDestinationState(destinationParsed.state)
    setDestinationPostcode(destinationParsed.postcode)
    setDestinationCountry(destinationParsed.country)

    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form fields to original values
    if (trip) {
      setAvailableCapacity(trip.available_capacity || "")
      if (trip.departure_time) {
        const depDate = new Date(trip.departure_time)
        const year = depDate.getFullYear()
        const month = String(depDate.getMonth() + 1).padStart(2, "0")
        const day = String(depDate.getDate()).padStart(2, "0")
        const hours = String(depDate.getHours()).padStart(2, "0")
        const minutes = String(depDate.getMinutes()).padStart(2, "0")
        setDepartureTime(`${year}-${month}-${day}T${hours}:${minutes}`)
      }
      if (trip.estimated_arrival) {
        const arrDate = new Date(trip.estimated_arrival)
        const year = arrDate.getFullYear()
        const month = String(arrDate.getMonth() + 1).padStart(2, "0")
        const day = String(arrDate.getDate()).padStart(2, "0")
        const hours = String(arrDate.getHours()).padStart(2, "0")
        const minutes = String(arrDate.getMinutes()).padStart(2, "0")
        setEstimatedArrival(`${year}-${month}-${day}T${hours}:${minutes}`)
      }
    }
    // Reset address fields
    setOriginStreetAddress("")
    setOriginAddressLine2("")
    setOriginCity("")
    setOriginState("")
    setOriginPostcode("")
    setOriginCountry("")
    setDestinationStreetAddress("")
    setDestinationAddressLine2("")
    setDestinationCity("")
    setDestinationState("")
    setDestinationPostcode("")
    setDestinationCountry("")
  }

  const buildAddressString = (
    street: string,
    line2: string,
    city: string,
    state: string,
    postcode: string,
    country: string
  ): string => {
    const parts = []
    if (street) parts.push(street)
    if (line2) parts.push(line2)
    if (city) parts.push(city)
    if (state) parts.push(state)
    if (postcode) parts.push(postcode)
    if (country) parts.push(country)
    return parts.join(", ")
  }

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
    ].filter((part) => part.length > 0)
    return parts.join(" ").replace(/\s+/g, " ")
  }

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
    const normalized1 = normalizeAddress(street1, line2_1, city1, state1, postcode1, country1)
    const normalized2 = normalizeAddress(street2, line2_2, city2, state2, postcode2, country2)
    return normalized1 === normalized2
  }

  const handleSave = async () => {
    if (!trip) return

    // Validate required address fields
    if (
      !originStreetAddress.trim() ||
      !originCity.trim() ||
      !originState.trim() ||
      !originPostcode.trim() ||
      !originCountry.trim()
    ) {
      toast.error("Please fill in all required origin address fields")
      return
    }

    if (
      !destinationStreetAddress.trim() ||
      !destinationCity.trim() ||
      !destinationState.trim() ||
      !destinationPostcode.trim() ||
      !destinationCountry.trim()
    ) {
      toast.error("Please fill in all required destination address fields")
      return
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
      toast.error("Origin and destination addresses cannot be the same")
      return
    }

    // Validate dates
    if (!departureTime || !departureTime.trim()) {
      toast.error("Departure time is required")
      return
    }

    if (!estimatedArrival || !estimatedArrival.trim()) {
      toast.error("Estimated arrival is required")
      return
    }

    const now = new Date()
    now.setSeconds(0, 0)

    const departureDate = new Date(departureTime)
    if (isNaN(departureDate.getTime())) {
      toast.error("Invalid departure time")
      return
    }
    if (departureDate < now) {
      toast.error("Departure time cannot be in the past")
      return
    }

    const arrivalDate = new Date(estimatedArrival)
    if (isNaN(arrivalDate.getTime())) {
      toast.error("Invalid estimated arrival time")
      return
    }
    if (arrivalDate < now) {
      toast.error("Estimated arrival cannot be in the past")
      return
    }

    if (arrivalDate <= departureDate) {
      toast.error("Estimated arrival must be after departure time")
      return
    }

    setSaving(true)

    try {
      const originAddress = buildAddressString(
        originStreetAddress,
        originAddressLine2,
        originCity,
        originState,
        originPostcode,
        originCountry
      )

      const destinationAddress = buildAddressString(
        destinationStreetAddress,
        destinationAddressLine2,
        destinationCity,
        destinationState,
        destinationPostcode,
        destinationCountry
      )

      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin_address: originAddress,
          destination_address: destinationAddress,
          departure_time: convertLocalToUTC(departureTime)!,
          estimated_arrival: convertLocalToUTC(estimatedArrival)!,
          available_capacity: availableCapacity || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update trip")
      }

      // Reload trip data
      const reloadResponse = await fetch(`/api/trips/${tripId}`)
      const reloadData = await reloadResponse.json()
      if (reloadResponse.ok) {
        setTrip(reloadData.trip)
      }

      setIsEditing(false)
      toast.success("Trip updated successfully!")
    } catch (error: any) {
      console.error("Error updating trip:", error)
      toast.error(error.message || "Failed to update trip")
    } finally {
      setSaving(false)
    }
  }

  const statusConfig: Record<Trip['status'], { label: string; color: string }> = {
    scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
    in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-800' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!trip) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Trip not found</p>
          <Link href="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return formatDate(dateString)
  }

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
            <h1 className="text-3xl font-bold text-gray-900">Trip Details</h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[trip.status].color}`}>
                {statusConfig[trip.status].label}
              </span>
              {!isEditing && trip.status !== 'completed' && (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition"
                  style={{ borderColor: '#29772F', color: '#29772F' }}
                >
                  Edit Trip
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {isEditing ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Trip</h2>
                
                <form className="space-y-6">
                  {/* Origin Address */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                      Origin Address
                    </h3>
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
                      }}
                      required
                      placeholder="Start typing origin address..."
                    />
                  </div>

                  {/* Destination Address */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                      Destination Address
                    </h3>
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
                      }}
                      required
                      placeholder="Start typing destination address..."
                    />
                  </div>

                  {/* Trip Details */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900">Trip Details</h3>

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

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#29772F' }}
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">Trip Information</h2>
                
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Origin Address</dt>
                    <dd className="mt-1 text-sm text-gray-900">{trip.origin_address}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Destination Address</dt>
                    <dd className="mt-1 text-sm text-gray-900">{trip.destination_address}</dd>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Departure Time</dt>
                      <dd className="mt-1 text-sm text-gray-900">{formatDateTime(trip.departure_time)}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Estimated Arrival</dt>
                      <dd className="mt-1 text-sm text-gray-900">{formatDateTime(trip.estimated_arrival)}</dd>
                    </div>
                  </div>

                  {trip.available_capacity && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Available Capacity</dt>
                      <dd className="mt-1 text-sm text-gray-900 capitalize">{trip.available_capacity}</dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created At</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(trip.created_at)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/dashboard/trips/new"
                  className="block w-full px-4 py-2 text-center bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  style={{ backgroundColor: '#29772F' }}
                >
                  Create New Trip
                </Link>
                <Link
                  href="/dashboard"
                  className="block w-full px-4 py-2 text-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  View All Trips
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}






