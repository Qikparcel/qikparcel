'use client'

import { Database } from '@/types/database'

type ParcelStatus = Database['public']['Tables']['parcels']['Row']['status']
type StatusHistory = Database['public']['Tables']['parcel_status_history']['Row']

interface ParcelTimelineProps {
  statusHistory: StatusHistory[]
  currentStatus: ParcelStatus
}

const statusConfig: Record<ParcelStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏳' },
  matched: { label: 'Matched', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🤝' },
  picked_up: { label: 'Picked Up', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '📦' },
  in_transit: { label: 'In Transit', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: '🚚' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-300', icon: '✓' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300', icon: '✗' },
}

export default function ParcelTimeline({ statusHistory, currentStatus }: ParcelTimelineProps) {
  // Sort history by created_at (oldest first)
  const sortedHistory = [...statusHistory].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Get all statuses in order
  const statusOrder: ParcelStatus[] = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'cancelled']
  const currentStatusIndex = statusOrder.indexOf(currentStatus)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Parcel Timeline</h2>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {statusOrder.map((status, index) => {
            const historyEntry = sortedHistory.find(h => h.status === status)
            const isCompleted = index <= currentStatusIndex
            const isCurrent = index === currentStatusIndex
            const config = statusConfig[status]

            return (
              <div key={status} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted
                    ? isCurrent
                      ? `${config.color} border-2`
                      : 'bg-primary-600 border-primary-600'
                    : 'bg-white border-gray-300'
                }`}>
                  {isCompleted ? (
                    <span className="text-sm">{config.icon}</span>
                  ) : (
                    <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${
                    isCurrent ? config.color : isCompleted ? 'bg-gray-100 text-gray-800 border-gray-300' : 'bg-white text-gray-500 border-gray-300'
                  }`}>
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </div>

                  {historyEntry && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">{formatDate(historyEntry.created_at)}</p>
                      {historyEntry.notes && (
                        <p className="text-sm text-gray-700 mt-1">{historyEntry.notes}</p>
                      )}
                      {historyEntry.location && (
                        <p className="text-sm text-gray-500 mt-1">📍 {historyEntry.location}</p>
                      )}
                    </div>
                  )}

                  {isCurrent && !historyEntry && (
                    <p className="text-sm text-gray-500 mt-2">Current status</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {sortedHistory.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No timeline history available</p>
        </div>
      )}
    </div>
  )
}


