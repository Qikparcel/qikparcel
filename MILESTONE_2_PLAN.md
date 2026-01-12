# Milestone 2 - Parcel & Trip Flows - Implementation Plan

## Overview
Build the core functionality for senders and couriers to create and manage parcels and trips.

## Deliverables

### 1. Create Parcel Request (Sender Flow)
- Form to create new parcel with:
  - Pickup address (text input)
  - Delivery address (text input)
  - Description
  - Weight (kg)
  - Dimensions (text)
  - Estimated value
- API route: POST /api/parcels
- Redirect to parcel detail page after creation

### 2. Create Trip Route (Courier Flow)
- Form to create new trip with:
  - Origin address
  - Destination address
  - Departure time
  - Estimated arrival
  - Available capacity (small/medium/large)
- API route: POST /api/trips
- Redirect to trip detail page after creation

### 3. Basic Dashboard
- Enhanced homepage showing:
  - For senders: List of their parcels
  - For couriers: List of their trips
- Quick stats (pending, in progress, completed)
- Navigation to create new parcel/trip

### 4. Parcel Timeline UI
- Component to show parcel status history
- Visual timeline with status changes
- Show dates and notes for each status change

## Implementation Order

1. ✅ Dashboard Layout Component (navigation, header)
2. ✅ API Routes (parcels, trips)
3. ✅ Create Parcel Page
4. ✅ Create Trip Page
5. ✅ Enhanced Dashboard (lists)
6. ✅ Parcel Timeline Component
7. ✅ Parcel Detail Page
8. ✅ Trip Detail Page

## Files to Create/Modify

### New Files
- `components/DashboardLayout.tsx` - Shared layout for dashboard pages
- `app/dashboard/parcels/new/page.tsx` - Create parcel form
- `app/dashboard/trips/new/page.tsx` - Create trip form
- `app/dashboard/parcels/[id]/page.tsx` - Parcel detail view
- `app/dashboard/trips/[id]/page.tsx` - Trip detail view
- `components/ParcelTimeline.tsx` - Timeline component
- `app/api/parcels/route.ts` - Parcel API (POST, GET)
- `app/api/trips/route.ts` - Trip API (POST, GET)
- `app/api/parcels/[id]/route.ts` - Parcel detail API (GET)

### Modified Files
- `app/dashboard/page.tsx` - Enhanced with lists
- Update middleware for new routes




