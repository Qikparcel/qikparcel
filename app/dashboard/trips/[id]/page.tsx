'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Database } from '@/types/database'

type Trip = Database['public']['Tables']['trips']['Row']

export default function TripDetailPage() {
  const router = useRouter()
  const params = useParams()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTrip() {
      try {
        const response = await fetch(`/api/trips/${tripId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load trip')
        }

        setTrip(data.trip)
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
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[trip.status].color}`}>
              {statusConfig[trip.status].label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
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






