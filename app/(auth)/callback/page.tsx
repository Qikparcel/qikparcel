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

      try {
        // Extract tokens from URL hash
        const hash = window.location.hash.substring(1)
        if (!hash) {
          throw new Error('No tokens found in URL')
        }

        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (!accessToken || !refreshToken) {
          throw new Error('Missing authentication tokens')
        }

        console.log('Calling API to set session cookies...')

        // Call API route to set session cookies server-side
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

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to set session')
        }

        console.log('Session set successfully')

        // Check if this is from signup (has saved form data)
        const savedData = localStorage.getItem('signup_form_data')
        if (savedData) {
          try {
            const data = JSON.parse(savedData)
            console.log('Found signup form data, updating profile...')

            // Get user ID from session
            const sessionResponse = await fetch('/api/auth/get-session')
            const sessionData = await sessionResponse.json()

            if (sessionData.user?.id) {
              // Update profile with saved data
              const updateResponse = await fetch('/api/auth/update-profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: sessionData.user.id,
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
            }
          } catch (err: any) {
            console.error('Error updating profile:', err)
          }
        }

        setStatus('success')
        toast.success('Logged in successfully!')

        // Small delay before redirect to ensure cookies are set
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 300)
      } catch (error: any) {
        console.error('Callback error:', error)
        setStatus('error')
        toast.error('Authentication failed: ' + (error.message || 'Unknown error'))
        
        // Redirect to login after error
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
