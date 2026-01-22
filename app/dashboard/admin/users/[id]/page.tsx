'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

export default function AdminUserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [userData, setUserData] = useState<Profile | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { createSupabaseClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Get admin profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single<Profile>()

        if (!profileData || profileData.role !== 'admin') {
          router.push('/dashboard')
          return
        }

        setProfile(profileData)

        // Fetch user data, parcels, and trips
        const response = await fetch(`/api/admin/users/${userId}/data`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setUserData(data.user)
            setParcels(data.parcels || [])
            setTrips(data.trips || [])
          }
        } else {
          console.error('Failed to load user data')
        }
      } catch (error) {
        console.error('Error loading user detail page:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, userId])

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    matched: 'bg-blue-100 text-blue-800',
    picked_up: 'bg-purple-100 text-purple-800',
    in_transit: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
  }

  const roleColors = {
    sender: 'bg-blue-100 text-blue-800',
    courier: 'bg-purple-100 text-purple-800',
    admin: 'bg-red-100 text-red-800',
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

  if (!profile || profile.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!userData) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600 mb-4">The user you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/dashboard/admin/users"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Users
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/admin/users"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Users
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Details</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              View user information, parcels, and trips
            </p>
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Full Name</label>
            <p className="text-gray-900">{userData.full_name || 'Not provided'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Phone Number</label>
            <p className="text-gray-900">{userData.phone_number}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="text-gray-900">{userData.email || 'Not provided'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Role</label>
            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${roleColors[userData.role] || 'bg-gray-100 text-gray-800'}`}>
              {userData.role}
            </span>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">WhatsApp Number</label>
            <p className="text-gray-900">{userData.whatsapp_number || 'Not provided'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Member Since</label>
            <p className="text-gray-900">{new Date(userData.created_at).toLocaleDateString()}</p>
          </div>
          {userData.street_address && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <p className="text-gray-900">{userData.street_address}</p>
                {userData.address_line_2 && (
                  <p className="text-gray-900">{userData.address_line_2}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">City, State, Postal Code</label>
                <p className="text-gray-900">
                  {[userData.city, userData.state, userData.postcode].filter(Boolean).join(', ')}
                </p>
                {userData.country && (
                  <p className="text-gray-900">{userData.country}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Parcels Section */}
      {(userData.role === 'sender' || userData.role === 'admin') && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Parcels ({parcels.length})</h2>
          </div>
          {parcels.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pickup
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {parcel.pickup_address}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {parcel.delivery_address}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[parcel.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
                          {parcel.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(parcel.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/parcels/${parcel.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No parcels found for this user.</p>
          )}
        </div>
      )}

      {/* Trips Section */}
      {(userData.role === 'courier' || userData.role === 'admin') && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Trips ({trips.length})</h2>
          </div>
          {trips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destination
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departure
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {trip.origin_address}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {trip.destination_address}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {trip.departure_time
                          ? new Date(trip.departure_time).toLocaleString()
                          : 'Not set'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[trip.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(trip.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No trips found for this user.</p>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
