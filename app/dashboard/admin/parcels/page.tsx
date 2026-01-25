'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Database } from '@/types/database'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Profile = Database['public']['Tables']['profiles']['Row']
type Match = {
  id: string
  trip_id: string
  match_score: number | null
  status: string
  matched_at: string
  accepted_at: string | null
  trip?: {
    id: string
    origin_address: string
    destination_address: string
    courier?: Pick<Profile, 'id' | 'full_name' | 'phone_number'>
  }
}

type Parcel = Database['public']['Tables']['parcels']['Row'] & {
  sender?: Pick<Profile, 'id' | 'full_name' | 'phone_number' | 'email'>
  matches?: Match[]
}

export default function AdminParcelsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const itemsPerPage = 20

  const loadParcels = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: statusFilter,
        search: searchQuery,
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
      })

      const response = await fetch(`/api/admin/parcels?${params}`)
      const data = await response.json()

      if (data.success) {
        setParcels(data.parcels || [])
        setTotal(data.total || 0)
      } else {
        toast.error(data.error || 'Failed to load parcels')
      }
    } catch (error) {
      console.error('Error loading parcels:', error)
      toast.error('Failed to load parcels')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, currentPage])

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Get user profile
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
      } catch (error) {
        console.error('Error loading admin parcels page:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (profile) {
      loadParcels()
    }
  }, [profile, loadParcels])

  const handleViewParcelDetails = (parcel: Parcel) => {
    setSelectedParcel(parcel)
    setIsDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedParcel(null)
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    matched: { label: 'Matched', color: 'bg-blue-100 text-blue-800' },
    picked_up: { label: 'Picked Up', color: 'bg-purple-100 text-purple-800' },
    in_transit: { label: 'In Transit', color: 'bg-indigo-100 text-indigo-800' },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  if (loading && !parcels.length) {
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">All Parcels</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Manage and monitor all parcel requests ({total} total)
            </p>
          </div>
          <Link
            href="/dashboard/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Admin Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by pickup or delivery address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="picked_up">Picked Up</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parcels Table */}
      {parcels.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parcel ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pickup
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parcels.map((parcel) => (
                  <tr key={parcel.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {parcel.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {parcel.sender?.full_name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {parcel.sender?.phone_number || parcel.sender?.email || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {parcel.pickup_address}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {parcel.delivery_address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusConfig[parcel.status]?.color || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusConfig[parcel.status]?.label || parcel.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {parcel.matches && parcel.matches.length > 0 ? (
                        <div className="space-y-1">
                          {parcel.matches.map((match) => (
                            <div key={match.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    match.status === 'accepted'
                                      ? 'bg-green-100 text-green-800'
                                      : match.status === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {match.status}
                                </span>
                                {match.match_score && (
                                  <span className="text-gray-500">
                                    Score: {match.match_score}
                                  </span>
                                )}
                              </div>
                              {match.trip && (
                                <div className="mt-1 text-gray-600">
                                  <Link
                                    href={`/dashboard/trips/${match.trip.id}`}
                                    className="hover:underline"
                                    style={{ color: '#29772F' }}
                                  >
                                    Trip: {match.trip.origin_address.substring(0, 30)}...
                                  </Link>
                                  {match.trip.courier && (
                                    <div className="text-gray-500">
                                      Courier: {match.trip.courier.full_name || match.trip.courier.phone_number}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No matches</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(parcel.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/dashboard/parcels/${parcel.id}`}
                        className="text-primary-600 hover:text-primary-900"
                        style={{ color: '#29772F' }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, total)} of {total} parcels
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No parcels found</h2>
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No parcels have been created yet'}
          </p>
        </div>
      )}
    </DashboardLayout>
  )
}
