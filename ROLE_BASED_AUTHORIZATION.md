# Role-Based Authorization Documentation

## Overview
The application implements role-based access control (RBAC) to ensure that senders and couriers can only access features and routes appropriate to their role.

## User Roles

1. **Sender** - Can create and manage parcels
2. **Courier** - Can create and manage trips
3. **Admin** - Can access all features (future implementation)

## Authorization Layers

### 1. Middleware Protection (`middleware.ts`)

The middleware enforces role-based route access at the edge:

- **Sender-only routes:**
  - `/dashboard/parcels/*` - Only accessible to users with `role = 'sender'`
  - `/api/parcels/*` - Only accessible to users with `role = 'sender'`

- **Courier-only routes:**
  - `/dashboard/trips/*` - Only accessible to users with `role = 'courier'`
  - `/api/trips/*` - Only accessible to users with `role = 'courier'`

- **Shared routes:**
  - `/dashboard` - Accessible to both senders and couriers (shows role-specific content)

**Behavior:**
- If a sender tries to access `/dashboard/trips/*`, they are redirected to `/dashboard`
- If a courier tries to access `/dashboard/parcels/*`, they are redirected to `/dashboard`
- API routes return 403 Forbidden with an error message

### 2. API Route Authorization

All API routes verify user role:

**Parcel Routes (`/api/parcels/*`):**
- POST `/api/parcels` - Checks `role === 'sender'`
- GET `/api/parcels` - Checks `role === 'sender'`
- GET `/api/parcels/[id]` - Checks `role === 'sender'` and verifies parcel ownership

**Trip Routes (`/api/trips/*`):**
- POST `/api/trips` - Checks `role === 'courier'`
- GET `/api/trips` - Checks `role === 'courier'`
- GET `/api/trips/[id]` - Checks `role === 'courier'` and verifies trip ownership

### 3. Page-Level Authorization

Dashboard pages include client-side role verification:

- **Create Parcel Page** (`/dashboard/parcels/new`)
  - Verifies user role is 'sender' on mount
  - Redirects to `/dashboard` if role is incorrect
  - Shows loading state during role check

- **Create Trip Page** (`/dashboard/trips/new`)
  - Verifies user role is 'courier' on mount
  - Redirects to `/dashboard` if role is incorrect
  - Shows loading state during role check

### 4. Database-Level Security (RLS)

Row Level Security (RLS) policies in Supabase ensure:

- Senders can only view/update their own parcels
- Couriers can only view/update their own trips
- Senders can view available trips (for matching - future feature)
- Couriers cannot access parcel data directly (except matched parcels)

## Implementation Details

### Middleware Flow

```
1. Check if route requires authentication
2. Verify session exists
3. For dashboard/API routes:
   a. Fetch user profile from database
   b. Check user role
   c. Verify role matches route requirements
   d. Redirect/block if unauthorized
```

### Error Responses

**Unauthorized Access (403 Forbidden):**
```json
{
  "error": "Forbidden: Only senders can access parcel routes"
}
```

**Missing Session (401 Unauthorized):**
- Redirects to `/login`

## Testing Authorization

### Test Cases

1. **Sender accessing courier route:**
   - Try: `GET /dashboard/trips/new` as sender
   - Expected: Redirect to `/dashboard`

2. **Courier accessing sender route:**
   - Try: `GET /dashboard/parcels/new` as courier
   - Expected: Redirect to `/dashboard`

3. **API route protection:**
   - Try: `POST /api/parcels` as courier
   - Expected: 403 Forbidden

4. **Unauthenticated access:**
   - Try: `GET /dashboard` without session
   - Expected: Redirect to `/login`

## Security Notes

1. **Multiple Layers:** Authorization is enforced at middleware, API, and page levels
2. **Database RLS:** Even if code fails, database policies prevent unauthorized data access
3. **Role Verification:** Every protected route verifies role from database (not just session)
4. **Error Messages:** Generic error messages prevent information leakage

## Future Enhancements

- Admin role support
- More granular permissions
- Role change audit logging
- Permission caching for performance




