'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Database } from '@/types/database'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Profile = Database['public']['Tables']['profiles']['Row']

interface Match {
  id: string
  parcel_id: string
  trip_id: string
  match_score: number | null
  status: string
  matched_at: string
  accepted_at: string | null
  parcel?: {
    id: string
    pickup_address: string
    delivery_address: string
    status: string
    sender?: Pick<Profile, 'id' | 'full_name' | 'phone_number'>
  }
  trip?: {
    id: string
    origin_address: string
    destination_address: string
    status: string
    courier?: Pick<Profile, 'id' | 'full_name' | 'phone_number'>
  }
}

export default function AdminMatchesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  })
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

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
        await loadMatches()
      } catch (error) {
        console.error('Error loading admin matches page:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const loadMatches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/matches')
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setMatches(data.recentMatches || [])
      } else {
        toast.error(data.error || 'Failed to load matches')
      }
    } catch (error) {
      console.error('Error loading matches:', error)
      toast.error('Failed to load matches')
    } finally {
      setLoading(false)
    }
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

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800' },
  }

  if (loading && !matches.length) {
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Matches Overview</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              View all parcel-trip matches and their status
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total Matches</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Pending</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Accepted</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.accepted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Rejected</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{stats.rejected}</div>
        </div>
      </div>

      {/* Matches Table */}
      {matches.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Matches</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Match ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parcel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trip
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matched At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {matches.map((match) => (
                  <tr key={match.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {match.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {match.parcel ? (
                        <div>
                          <Link
                            href={`/dashboard/parcels/${match.parcel.id}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: '#29772F' }}
                          >
                            Parcel {match.parcel.id.slice(0, 8)}...
                          </Link>
                          <div className="text-xs text-gray-500 mt-1">
                            {match.parcel.pickup_address.substring(0, 40)}...
                          </div>
                          {match.parcel.sender && (
                            <div className="text-xs text-gray-500">
                              Sender: {match.parcel.sender.full_name || match.parcel.sender.phone_number}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {match.trip ? (
                        <div>
                          <Link
                            href={`/dashboard/trips/${match.trip.id}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: '#29772F' }}
                          >
                            Trip {match.trip.id.slice(0, 8)}...
                          </Link>
                          <div className="text-xs text-gray-500 mt-1">
                            {match.trip.origin_address.substring(0, 40)}...
                          </div>
                          {match.trip.courier && (
                            <div className="text-xs text-gray-500">
                              Courier: {match.trip.courier.full_name || match.trip.courier.phone_number}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {match.match_score ? `${match.match_score}/100` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusConfig[match.status]?.color || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusConfig[match.status]?.label || match.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(match.matched_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No matches found</h2>
          <p className="text-gray-600">No parcel-trip matches have been created yet.</p>
        </div>
      )}
    </DashboardLayout>
  )
}
