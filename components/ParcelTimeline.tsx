'use client'

import { Database } from '@/types/database'

type ParcelStatus = Database['public']['Tables']['parcels']['Row']['status']
type StatusHistory = Database['public']['Tables']['parcel_status_history']['Row']

interface ParcelTimelineProps {
  statusHistory: StatusHistory[]
  currentStatus: ParcelStatus
}

const statusConfig: Record<ParcelStatus, { 
  label: string; 
  color: string; 
  icon: string; 
  explanation: string;
}> = {
  pending: { 
    label: 'Pending', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300', 
    icon: '⏳',
    explanation: 'Parcel request created and waiting to be matched with a traveller'
  },
  matched: { 
    label: 'Matched', 
    color: 'bg-blue-100 text-blue-800 border-blue-300', 
    icon: '🤝',
    explanation: 'Parcel has been matched with a verified traveller heading in the same direction'
  },
  picked_up: { 
    label: 'Picked Up', 
    color: 'bg-purple-100 text-purple-800 border-purple-300', 
    icon: '📦',
    explanation: 'Traveller has collected the parcel from the pickup location'
  },
  in_transit: { 
    label: 'In Transit', 
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300', 
    icon: '🚚',
    explanation: 'Parcel is on the way to the delivery destination'
  },
  delivered: { 
    label: 'Delivered', 
    color: 'bg-green-100 text-green-800 border-green-300', 
    icon: '✓',
    explanation: 'Parcel has been successfully delivered to the recipient'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-100 text-red-800 border-red-300', 
    icon: '✗',
    explanation: 'Delivery has been cancelled. Refund depends on cancellation stage'
  },
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
                {/* Timeline dot with tooltip */}
                <div className="relative group/dot z-10">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 cursor-help ${
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
                  
                  {/* Tooltip for dot */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/dot:opacity-100 group-hover/dot:visible transition-all duration-200 z-50 pointer-events-none">
                    <p className="leading-relaxed">{config.explanation}</p>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="relative group inline-block">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border cursor-help ${
                      isCurrent ? config.color : isCompleted ? 'bg-gray-100 text-gray-800 border-gray-300' : 'bg-white text-gray-500 border-gray-300'
                    }`}>
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                      <p className="leading-relaxed">{config.explanation}</p>
                      {/* Tooltip arrow */}
                      <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                    </div>
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



