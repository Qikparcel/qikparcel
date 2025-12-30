'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * Client-side callback page that handles magic link tokens
 * Extracts tokens from URL hash and calls API to set session cookies server-side
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')

  useEffect(() => {
    const handleCallback = async () => {
      if (typeof window === 'undefined') return

      console.log('[CALLBACK] Starting callback handler')
      console.log('[CALLBACK] Current URL:', window.location.href)
      console.log('[CALLBACK] URL hash:', window.location.hash)

      try {
        // Extract tokens from URL hash
        const hash = window.location.hash.substring(1)
        console.log('[CALLBACK] Hash substring:', hash ? 'found' : 'empty')
        
        if (!hash) {
          console.error('[CALLBACK] ERROR: No hash found in URL')
          throw new Error('No tokens found in URL')
        }

        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        console.log('[CALLBACK] Tokens extracted:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenLength: accessToken?.length || 0,
          refreshTokenLength: refreshToken?.length || 0,
        })

        if (!accessToken || !refreshToken) {
          console.error('[CALLBACK] ERROR: Missing tokens', { accessToken: !!accessToken, refreshToken: !!refreshToken })
          throw new Error('Missing authentication tokens')
        }

        console.log('[CALLBACK] Calling API to set session cookies...')

        // Call API route to set session cookies server-side
        console.log('[CALLBACK] Fetching /api/auth/callback...')
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        })

        console.log('[CALLBACK] API response status:', response.status, response.statusText)
        const data = await response.json()
        console.log('[CALLBACK] API response data:', { success: data.success, error: data.error })

        if (!response.ok) {
          console.error('[CALLBACK] API ERROR:', data)
          throw new Error(data.error || 'Failed to set session')
        }

        console.log('[CALLBACK] Session set successfully via API')

        // Also set session client-side to ensure it's accessible
        console.log('[CALLBACK] Setting session client-side...')
        const { createSupabaseClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseClient()
        
        // Set session client-side as well (this ensures cookies are set on both server and client)
        const { data: { session: clientSession }, error: clientError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (clientError || !clientSession) {
          console.error('[CALLBACK] WARNING: Failed to set session client-side:', clientError)
          // Don't throw here, server-side session might still work
        } else {
          console.log('[CALLBACK] Session set client-side successfully:', {
            userId: clientSession.user.id,
            email: clientSession.user.email,
            expiresAt: clientSession.expires_at,
          })
        }

        // Wait a bit for cookies to propagate
        console.log('[CALLBACK] Waiting 300ms for cookies to propagate...')
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Verify session is accessible
        console.log('[CALLBACK] Verifying session is accessible...')
        const { data: { session: verifySession }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !verifySession) {
          console.error('[CALLBACK] ERROR: Session not accessible after setting:', {
            error: sessionError,
            hasSession: !!verifySession,
          })
          throw new Error('Session was not properly set. Please try again.')
        }

        console.log('[CALLBACK] Session verified successfully:', {
          userId: verifySession.user.id,
          email: verifySession.user.email,
          expiresAt: verifySession.expires_at,
        })

        // Check if this is from signup (has saved form data)
        console.log('[CALLBACK] Checking for signup form data...')
        const savedData = localStorage.getItem('signup_form_data')
        if (savedData) {
          try {
            const data = JSON.parse(savedData)
            console.log('[CALLBACK] Found signup form data, updating profile...', {
              hasFullName: !!data.fullName,
              hasRole: !!data.role,
              hasAddress: !!data.address,
              hasEmail: !!data.email,
            })

            // Use the verified session user ID
            const updateResponse = await fetch('/api/auth/update-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: verifySession.user.id,
                fullName: data.fullName,
                role: data.role,
                address: data.address,
                email: data.email,
                documentType: data.documentType,
                documentPath: data.documentPath,
              }),
            })

            if (updateResponse.ok) {
              console.log('Profile updated successfully')
              localStorage.removeItem('signup_form_data')
            } else {
              console.error('Failed to update profile')
            }
          } catch (err: any) {
            console.error('Error updating profile:', err)
          }
        }

        setStatus('success')
        toast.success('Logged in successfully!')

        // Use full page reload to ensure cookies are read by middleware
        console.log('[CALLBACK] All checks passed, redirecting to /dashboard...')
        window.location.href = '/dashboard'
      } catch (error: any) {
        console.error('[CALLBACK] FATAL ERROR:', {
          message: error.message,
          stack: error.stack,
          error: error,
        })
        setStatus('error')
        toast.error('Authentication failed: ' + (error.message || 'Unknown error'))
        
        // Redirect to login after error
        console.log('[CALLBACK] Redirecting to /login after error...')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700">Completing sign-in...</h2>
            <p className="text-gray-500 mt-2">Please wait</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-700">Sign-in successful!</h2>
            <p className="text-gray-500 mt-2">Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-gray-700">Sign-in failed</h2>
            <p className="text-gray-500 mt-2">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  )
}
