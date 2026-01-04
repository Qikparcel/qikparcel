'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase/client'

export default function CreateParcelPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [roleCheckLoading, setRoleCheckLoading] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  
  // Pickup address fields
  const [pickupStreetAddress, setPickupStreetAddress] = useState('')
  const [pickupAddressLine2, setPickupAddressLine2] = useState('')
  const [pickupCity, setPickupCity] = useState('')
  const [pickupState, setPickupState] = useState('')
  const [pickupPostcode, setPickupPostcode] = useState('')
  const [pickupCountry, setPickupCountry] = useState('')
  
  // Delivery address fields
  const [deliveryStreetAddress, setDeliveryStreetAddress] = useState('')
  const [deliveryAddressLine2, setDeliveryAddressLine2] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryState, setDeliveryState] = useState('')
  const [deliveryPostcode, setDeliveryPostcode] = useState('')
  const [deliveryCountry, setDeliveryCountry] = useState('')
  
  // Other fields
  const [formData, setFormData] = useState({
    description: '',
    weight_kg: '',
    dimensions: '',
    estimated_value: '',
  })

  // Verify user role on mount
  useEffect(() => {
    async function checkRole() {
      const supabase = createSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single<{ role: 'sender' | 'courier' | 'admin' }>()

      if (!profile || profile.role !== 'sender') {
        toast.error('Only senders can create parcels')
        router.push('/dashboard')
        return
      }

      setRoleCheckLoading(false)
    }

    checkRole()
  }, [router])

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
    return parts.join(', ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptedTerms) {
      toast.error('Please read and accept the Terms and Conditions to continue')
      return
    }

    // Validate required address fields
    if (!pickupStreetAddress.trim() || !pickupCity.trim() || !pickupState.trim() || !pickupPostcode.trim() || !pickupCountry.trim()) {
      toast.error('Please fill in all required pickup address fields')
      return
    }

    if (!deliveryStreetAddress.trim() || !deliveryCity.trim() || !deliveryState.trim() || !deliveryPostcode.trim() || !deliveryCountry.trim()) {
      toast.error('Please fill in all required delivery address fields')
      return
    }

    // Build address strings
    const pickupAddress = buildAddressString(
      pickupStreetAddress,
      pickupAddressLine2,
      pickupCity,
      pickupState,
      pickupPostcode,
      pickupCountry
    )

    const deliveryAddress = buildAddressString(
      deliveryStreetAddress,
      deliveryAddressLine2,
      deliveryCity,
      deliveryState,
      deliveryPostcode,
      deliveryCountry
    )
    
    setLoading(true)

    try {
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          description: formData.description.trim() || null,
          weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
          dimensions: formData.dimensions.trim() || null,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create parcel')
      }

      toast.success('Parcel created successfully!')
      router.push(`/dashboard/parcels/${data.parcel.id}`)
    } catch (error: any) {
      console.error('Error creating parcel:', error)
      toast.error(error.message || 'Failed to create parcel')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (roleCheckLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create New Parcel</h1>
          <p className="mt-2 text-gray-600">Fill in the details to create a parcel request</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-8">
          {/* Pickup Address */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Pickup Address</h2>
            
            <div>
              <label htmlFor="pickup_street_address" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                id="pickup_street_address"
                value={pickupStreetAddress}
                onChange={(e) => setPickupStreetAddress(e.target.value)}
                placeholder="123 Main Street"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            <div>
              <label htmlFor="pickup_address_line_2" className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                id="pickup_address_line_2"
                value={pickupAddressLine2}
                onChange={(e) => setPickupAddressLine2(e.target.value)}
                placeholder="Apartment, suite, unit, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pickup_city" className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  id="pickup_city"
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  placeholder="City"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label htmlFor="pickup_state" className="block text-sm font-medium text-gray-700 mb-2">
                  State/Province *
                </label>
                <input
                  type="text"
                  id="pickup_state"
                  value={pickupState}
                  onChange={(e) => setPickupState(e.target.value)}
                  placeholder="State"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pickup_postcode" className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode/ZIP *
                </label>
                <input
                  type="text"
                  id="pickup_postcode"
                  value={pickupPostcode}
                  onChange={(e) => setPickupPostcode(e.target.value)}
                  placeholder="12345"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label htmlFor="pickup_country" className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <input
                  type="text"
                  id="pickup_country"
                  value={pickupCountry}
                  onChange={(e) => setPickupCountry(e.target.value)}
                  placeholder="Country"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Address</h2>
            
            <div>
              <label htmlFor="delivery_street_address" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                id="delivery_street_address"
                value={deliveryStreetAddress}
                onChange={(e) => setDeliveryStreetAddress(e.target.value)}
                placeholder="123 Main Street"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            <div>
              <label htmlFor="delivery_address_line_2" className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                id="delivery_address_line_2"
                value={deliveryAddressLine2}
                onChange={(e) => setDeliveryAddressLine2(e.target.value)}
                placeholder="Apartment, suite, unit, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="delivery_city" className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  id="delivery_city"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  placeholder="City"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label htmlFor="delivery_state" className="block text-sm font-medium text-gray-700 mb-2">
                  State/Province *
                </label>
                <input
                  type="text"
                  id="delivery_state"
                  value={deliveryState}
                  onChange={(e) => setDeliveryState(e.target.value)}
                  placeholder="State"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="delivery_postcode" className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode/ZIP *
                </label>
                <input
                  type="text"
                  id="delivery_postcode"
                  value={deliveryPostcode}
                  onChange={(e) => setDeliveryPostcode(e.target.value)}
                  placeholder="12345"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label htmlFor="delivery_country" className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <input
                  type="text"
                  id="delivery_country"
                  value={deliveryCountry}
                  onChange={(e) => setDeliveryCountry(e.target.value)}
                  placeholder="Country"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            </div>
          </div>

          {/* Parcel Details */}
          <div className="space-y-4 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Parcel Details</h2>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what you're sending (optional)"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="weight_kg" className="block text-sm font-medium text-gray-700 mb-2">
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
              <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700 mb-2">
                Dimensions
              </label>
              <input
                type="text"
                id="dimensions"
                name="dimensions"
                value={formData.dimensions}
                onChange={handleChange}
                placeholder="e.g., 30x20x15 cm"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>
          </div>

          <div>
            <label htmlFor="estimated_value" className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Value
            </label>
            <input
              type="number"
              id="estimated_value"
              name="estimated_value"
              value={formData.estimated_value}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
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
                style={{ accentColor: '#29772F' }}
                required
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-700 flex-1">
                I have read and agree to the{' '}
                <Link
                  href="/terms/general"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: '#29772F' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                {', '}
                <Link
                  href="/terms/sender"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: '#29772F' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Sender Terms and Conditions
                </Link>
                {' '}and the{' '}
                <Link
                  href="/terms/prohibited-items"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                  style={{ color: '#29772F' }}
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
              style={{ backgroundColor: '#29772F' }}
            >
              {loading ? 'Creating...' : 'Create Parcel'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
