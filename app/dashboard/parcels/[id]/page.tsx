'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import ParcelTimeline from '@/components/ParcelTimeline'
import { Database } from '@/types/database'

type Parcel = Database['public']['Tables']['parcels']['Row']
type StatusHistory = Database['public']['Tables']['parcel_status_history']['Row']

export default function ParcelDetailPage() {
  const router = useRouter()
  const params = useParams()
  const parcelId = params.id as string

  const [parcel, setParcel] = useState<Parcel | null>(null)
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadParcel() {
      try {
        const response = await fetch(`/api/parcels/${parcelId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load parcel')
        }

        setParcel(data.parcel)
        setStatusHistory(data.statusHistory || [])
      } catch (error: any) {
        console.error('Error loading parcel:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    if (parcelId) {
      loadParcel()
    }
  }, [parcelId, router])

  const statusConfig: Record<Parcel['status'], { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    matched: { label: 'Matched', color: 'bg-blue-100 text-blue-800' },
    picked_up: { label: 'Picked Up', color: 'bg-purple-100 text-purple-800' },
    in_transit: { label: 'In Transit', color: 'bg-indigo-100 text-indigo-800' },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
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

  if (!parcel) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Parcel not found</p>
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
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[parcel.status].color}`}>
              {statusConfig[parcel.status].label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Parcel Information</h2>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Pickup Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parcel.pickup_address}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Delivery Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parcel.delivery_address}</dd>
                </div>

                {parcel.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{parcel.description}</dd>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {parcel.weight_kg && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Weight</dt>
                      <dd className="mt-1 text-sm text-gray-900">{parcel.weight_kg} kg</dd>
                    </div>
                  )}

                  {parcel.dimensions && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
                      <dd className="mt-1 text-sm text-gray-900">{parcel.dimensions}</dd>
                    </div>
                  )}
                </div>

                {parcel.estimated_value && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Estimated Value</dt>
                    <dd className="mt-1 text-sm text-gray-900">${parcel.estimated_value.toFixed(2)}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(parcel.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Timeline */}
            <ParcelTimeline statusHistory={statusHistory} currentStatus={parcel.status} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/dashboard/parcels/new"
                  className="block w-full px-4 py-2 text-center bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  style={{ backgroundColor: '#29772F' }}
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
  )
}


