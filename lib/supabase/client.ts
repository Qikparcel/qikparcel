import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const isE2EMockAuthEnabled = () =>
  process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === '1' &&
  typeof window !== 'undefined'

const getE2EMockSession = () => {
  const enabled = window.localStorage.getItem('e2e_auth_enabled') === '1'
  if (!enabled) return null

  const userId = window.localStorage.getItem('e2e_auth_user_id') || 'e2e-user'
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    user: { id: userId },
  } as any
}

const getE2EMockProfile = () => {
  const role =
    (window.localStorage.getItem('e2e_auth_role') as
      | 'sender'
      | 'courier'
      | 'admin'
      | null) || 'sender'

  return {
    id: window.localStorage.getItem('e2e_auth_user_id') || 'e2e-user',
    role,
    full_name: window.localStorage.getItem('e2e_auth_name') || 'E2E User',
    phone_number: window.localStorage.getItem('e2e_auth_phone') || '+10000000000',
    whatsapp_number: window.localStorage.getItem('e2e_auth_phone') || '+10000000000',
  } as any
}

const createE2EMockClient = () => {
  return {
    auth: {
      async getSession() {
        return { data: { session: getE2EMockSession() }, error: null }
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        }
      },
      async signOut() {
        window.localStorage.removeItem('e2e_auth_enabled')
        return { error: null }
      },
    },
    from(table: string) {
      const state: { selected?: string; eqField?: string; eqValue?: string } = {}
      const builder = {
        select(selection: string) {
          state.selected = selection
          return builder
        },
        eq(field: string, value: string) {
          state.eqField = field
          state.eqValue = value
          return builder
        },
        async single<T>() {
          if (table === 'profiles') {
            const profile = getE2EMockProfile()
            if (state.eqField === 'id' && state.eqValue && state.eqValue !== profile.id) {
              return { data: null as T | null, error: { message: 'Profile not found' } }
            }
            return { data: profile as T, error: null }
          }
          return { data: null as T | null, error: { message: `Unsupported table in e2e mock: ${table}` } }
        },
      }
      return builder
    },
  } as any
}

// Client-side Supabase client (for use in components)
export const createSupabaseClient = () => {
  if (isE2EMockAuthEnabled()) {
    return createE2EMockClient()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Client-side Supabase client (alternative for client components)
export const getSupabaseClient = () => {
  return createSupabaseClient()
}

// Server-side Supabase client (for use in API routes and server components)
export const createSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Admin client with service role key (for admin operations and webhooks)
// This bypasses RLS policies
export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

