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
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null)

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
              hasAddress: !!(data.streetAddress && data.city && data.country),
              hasEmail: !!data.email,
            })

            // Use the verified session user ID
            console.log('[CALLBACK] Calling update-profile API with data:', {
              userId: verifySession.user.id,
              hasFullName: !!data.fullName,
              hasRole: !!data.role,
              hasStreetAddress: !!data.streetAddress,
              hasAddressLine2: data.addressLine2 !== undefined,
              hasCity: !!data.city,
              hasState: !!data.state,
              hasPostcode: !!data.postcode,
              hasCountry: !!data.country,
              hasEmail: !!data.email,
            })

            // Build request body - include all fields for both sender and courier
            const updateBody: any = {
              userId: verifySession.user.id,
            }
            
            // Required fields for both sender and courier
            if (data.fullName) updateBody.fullName = data.fullName
            if (data.role) updateBody.role = data.role
            
            // Address fields - required for both sender and courier
            if (data.streetAddress) updateBody.streetAddress = data.streetAddress
            if (data.addressLine2 !== undefined) updateBody.addressLine2 = data.addressLine2
            if (data.city) updateBody.city = data.city
            if (data.state) updateBody.state = data.state
            if (data.postcode) updateBody.postcode = data.postcode
            if (data.country) updateBody.country = data.country
            
            // Optional fields
            if (data.email !== undefined) updateBody.email = data.email || null
            if (data.documentType) updateBody.documentType = data.documentType
            if (data.documentPath) updateBody.documentPath = data.documentPath

            console.log('[CALLBACK] Update body:', updateBody)

            const updateResponse = await fetch('/api/auth/update-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updateBody),
            })

            const updateResult = await updateResponse.json()

            if (updateResponse.ok) {
              console.log('[CALLBACK] Profile updated successfully:', updateResult)
              localStorage.removeItem('signup_form_data')
              localStorage.removeItem('profile_update_error') // Clear any previous errors
              toast.success('Profile information saved!')
            } else {
              // Build detailed error message
              const errorMsg = updateResult.error || updateResult.message || 'Unknown error'
              const detailsMsg = updateResult.details ? `\nDetails: ${updateResult.details}` : ''
              const hintMsg = updateResult.hint ? `\nHint: ${updateResult.hint}` : ''
              const fullErrorMsg = `Failed to save profile: ${errorMsg}${detailsMsg}${hintMsg}`
              
              console.error('[CALLBACK] Failed to update profile:', {
                status: updateResponse.status,
                statusText: updateResponse.statusText,
                error: updateResult,
                updateBody,
                fullError: fullErrorMsg,
              })
              
              // Store error in localStorage so it persists after redirect
              const errorData = {
                message: fullErrorMsg,
                details: updateResult.details || '',
                hint: updateResult.hint || '',
                timestamp: new Date().toISOString(),
                updateBody: updateBody,
              }
              localStorage.setItem('profile_update_error', JSON.stringify(errorData))
              
              // Set state to show error on page
              setProfileUpdateError(fullErrorMsg)
              
              // Show toast with error
              toast.error(fullErrorMsg, {
                duration: 10000,
              })
              
              // Don't block the user from continuing - they can update profile later
              console.warn('[CALLBACK] Continuing despite profile update failure - user can update profile later')
              
              // Wait a bit so user can see the error
              await new Promise((resolve) => setTimeout(resolve, 3000))
            }
          } catch (err: any) {
            console.error('Error updating profile:', err)
          }
        }

        setStatus('success')
        toast.success('Logged in successfully!')

        // Use full page reload to ensure cookies are read by middleware
        console.log('[CALLBACK] All checks passed, redirecting to /dashboard...')
        
        // Delay redirect slightly to ensure error messages are logged
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error'
        const fullError = `Authentication failed: ${errorMsg}`
        
        console.error('[CALLBACK] FATAL ERROR:', {
          message: error.message,
          stack: error.stack,
          error: error,
          fullError: fullError,
        })
        
        // Store error in localStorage for persistence
        localStorage.setItem('auth_callback_error', JSON.stringify({
          message: fullError,
          details: error.stack || '',
          timestamp: new Date().toISOString(),
        }))
        
        setStatus('error')
        setErrorMessage(fullError)
        toast.error(fullError, {
          duration: 10000,
        })
        
        // Redirect to login after error (with delay to show error)
        console.log('[CALLBACK] Redirecting to /login after error...')
        setTimeout(() => {
          window.location.href = '/login'
        }, 5000) // Longer delay to see error
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700">Completing sign-in...</h2>
            <p className="text-gray-500 mt-2">Please wait</p>
            {profileUpdateError && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm text-left">
                <p className="font-medium">Profile update warning:</p>
                <p className="mt-1 whitespace-pre-wrap">{profileUpdateError}</p>
                <p className="mt-2 text-xs">You can update your profile later in settings.</p>
              </div>
            )}
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-700">Sign-in successful!</h2>
            <p className="text-gray-500 mt-2">Redirecting to dashboard...</p>
            {profileUpdateError && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm text-left">
                <p className="font-medium">Note:</p>
                <p className="mt-1 whitespace-pre-wrap">{profileUpdateError}</p>
                <p className="mt-2 text-xs">You can update your profile in settings.</p>
              </div>
            )}
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-gray-700">Sign-in failed</h2>
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm text-left">
                <p className="font-medium">Error details:</p>
                <p className="mt-1 whitespace-pre-wrap">{errorMessage}</p>
                <p className="mt-2 text-xs">Check the browser console (F12) for more details.</p>
              </div>
            )}
            <p className="text-gray-500 mt-4">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  )
}
