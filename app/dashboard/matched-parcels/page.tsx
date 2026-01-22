'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/DashboardLayout'
import { Database } from '@/types/database'

type Parcel = Database['public']['Tables']['parcels']['Row']
type StatusHistory = Database['public']['Tables']['parcel_status_history']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

interface ParcelWithTrip extends Parcel {
  matched_trip: Trip | null
  sender: {
    id: string
    full_name: string | null
    phone_number: string
    whatsapp_number: string | null
  } | null
}

export default function MatchedParcelsPage() {
  const router = useRouter()
  const [parcels, setParcels] = useState<ParcelWithTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    loadMatchedParcels()
  }, [])

  async function loadMatchedParcels() {
    setLoading(true)
    try {
      const response = await fetch('/api/courier/matched-parcels')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load matched parcels')
      }

      setParcels(data.parcels || [])
    } catch (error: any) {
      console.error('Error loading matched parcels:', error)
      toast.error(error.message || 'Failed to load matched parcels')
    } finally {
      setLoading(false)
    }
  }

  async function updateParcelStatus(parcelId: string, status: string, notes?: string) {
    setUpdatingStatus(parcelId)
    try {
      const response = await fetch(`/api/parcels/${parcelId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success(`Parcel status updated to ${status.replace('_', ' ')}`)
      await loadMatchedParcels()
    } catch (error: any) {
      console.error('Error updating parcel status:', error)
      toast.error(error.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const statusConfig: Record<string, { label: string; color: string; nextStatuses: string[] }> = {
    matched: {
      label: 'Matched',
      color: 'bg-blue-100 text-blue-800',
      nextStatuses: ['picked_up', 'cancelled'],
    },
    picked_up: {
      label: 'Picked Up',
      color: 'bg-purple-100 text-purple-800',
      nextStatuses: ['in_transit', 'cancelled'],
    },
    in_transit: {
      label: 'In Transit',
      color: 'bg-yellow-100 text-yellow-800',
      nextStatuses: ['delivered', 'cancelled'],
    },
    delivered: {
      label: 'Delivered',
      color: 'bg-green-100 text-green-800',
      nextStatuses: [],
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-red-100 text-red-800',
      nextStatuses: [],
    },
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

  if (loading) {
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-block"
              style={{ color: '#29772F' }}
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Matched Parcels</h1>
          <p className="text-gray-600 mt-2">Manage parcels matched to your trips</p>
        </div>

        {parcels.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No matched parcels found</p>
            <p className="text-gray-400 text-sm mt-2">
              Parcels matched to your trips will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {parcels.map((parcel) => (
              <div key={parcel.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[parcel.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusConfig[parcel.status]?.label || parcel.status}
                      </span>
                      {parcel.matched_trip && (
                        <Link
                          href={`/dashboard/trips/${parcel.matched_trip.id}`}
                          className="text-sm text-primary-600 hover:text-primary-700"
                          style={{ color: '#29772F' }}
                        >
                          View Trip →
                        </Link>
                      )}
                    </div>
                    {parcel.sender && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Sender:</span>{' '}
                        {parcel.sender.full_name || parcel.sender.phone_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pickup Address</dt>
                    <dd className="mt-1 text-sm text-gray-900">{parcel.pickup_address}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Delivery Address</dt>
                    <dd className="mt-1 text-sm text-gray-900">{parcel.delivery_address}</dd>
                  </div>
                </div>

                {parcel.description && (
                  <div className="mb-4">
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{parcel.description}</dd>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  {parcel.weight_kg && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      ⚖️ {parcel.weight_kg} kg
                    </span>
                  )}
                  {parcel.dimensions && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      📦 {parcel.dimensions}
                    </span>
                  )}
                </div>

                {/* Status Update Actions */}
                {statusConfig[parcel.status]?.nextStatuses.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Update Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {statusConfig[parcel.status].nextStatuses.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => updateParcelStatus(parcel.id, nextStatus)}
                          disabled={updatingStatus === parcel.id}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            nextStatus === 'cancelled'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                          style={
                            nextStatus !== 'cancelled'
                              ? { backgroundColor: '#29772F' }
                              : undefined
                          }
                        >
                          {updatingStatus === parcel.id
                            ? 'Updating...'
                            : nextStatus === 'picked_up'
                            ? 'Mark as Picked Up'
                            : nextStatus === 'in_transit'
                            ? 'Mark as In Transit'
                            : nextStatus === 'delivered'
                            ? 'Mark as Delivered'
                            : 'Cancel Parcel'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t">
                  <Link
                    href={`/dashboard/parcels/${parcel.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    style={{ color: '#29772F' }}
                  >
                    View Full Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
