'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createSupabaseClient } from '@/lib/supabase/client'

type SignupStep = 'basic' | 'details' | 'otp'

export default function SignUpPage() {
  const router = useRouter()
  
  // Basic info
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [role, setRole] = useState<'sender' | 'courier'>('sender')
  
  // Role-specific details
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('') // For sender only
  const [documentFile, setDocumentFile] = useState<File | null>(null) // For courier only
  const [documentType, setDocumentType] = useState('national_id')
  
  // OTP step
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<SignupStep>('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('signup_form_data')
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        setFullName(data.fullName || '')
        setPhoneNumber(data.phoneNumber || '')
        setRole(data.role || 'sender')
        setAddress(data.address || '')
        setEmail(data.email || '')
        setDocumentType(data.documentType || 'national_id')
        // Note: documentFile cannot be restored from localStorage, but we'll upload it before redirect
      } catch (err) {
        console.error('Error loading saved form data:', err)
      }
    }
  }, [])

  // Check for auth tokens in URL hash (from magic link redirect)
  useEffect(() => {
    const handleMagicLinkAuth = async () => {
      if (typeof window === 'undefined') return

      const hash = window.location.hash.substring(1)
      if (!hash) return

      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        try {
          setLoading(true)
          const supabase = createSupabaseClient()
          
          console.log('Setting session with tokens from URL hash (signup)')
          
          const { data: { session }, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Error setting session:', sessionError)
            toast.error('Failed to complete sign-up: ' + sessionError.message)
            window.history.replaceState(null, '', '/signup')
            localStorage.removeItem('signup_form_data')
            setLoading(false)
            return
          }

          if (!session || !session.user) {
            console.error('Session not created after setting tokens')
            toast.error('Failed to create session')
            window.history.replaceState(null, '', '/signup')
            localStorage.removeItem('signup_form_data')
            setLoading(false)
            return
          }

          console.log('Session created successfully:', session.user.id)

          // Clear the hash from URL
          window.history.replaceState(null, '', '/signup')

          // Wait for session to be persisted to cookies
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Verify session is still there after delay
          const { data: { session: verifySession } } = await supabase.auth.getSession()

          if (!verifySession) {
            console.error('Session lost after setting')
            toast.error('Session was not persisted. Please try again.')
            localStorage.removeItem('signup_form_data')
            setLoading(false)
            return
          }

          // Load saved form data
          const savedData = localStorage.getItem('signup_form_data')
          if (savedData) {
            const data = JSON.parse(savedData)
            
            // Update profile with saved data (document should already be uploaded before redirect)
            await updateProfileFromSavedData(session.user.id, data)
            
            // Clear saved data
            localStorage.removeItem('signup_form_data')
          } else {
            console.warn('No saved form data found, profile may not have all fields')
          }
          
          console.log('Session verified, redirecting to dashboard')
          toast.success('Account created successfully!')
          
          // Use full page reload to ensure cookies are properly read by middleware
          window.location.href = '/dashboard'
        } catch (err: any) {
          console.error('Error handling magic link auth:', err)
          toast.error('Failed to complete sign-up')
          window.history.replaceState(null, '', '/signup')
          localStorage.removeItem('signup_form_data')
        } finally {
          setLoading(false)
        }
      }
    }

    handleMagicLinkAuth()
  }, [router])

  const updateProfileFromSavedData = async (userId: string, data: any) => {
    try {
      // Update profile with saved data (document should already be uploaded)
      const updateResponse = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          fullName: data.fullName,
          role: data.role,
          address: data.address,
          email: data.role === 'sender' ? data.email : undefined,
          documentPath: data.documentPath, // Should be set if document was uploaded before redirect
          documentType: data.documentType,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }
    } catch (err: any) {
      console.error('Error updating profile from saved data:', err)
      throw err
    }
  }

  const updateProfileWithDetails = async (userId: string) => {
    try {
      let documentPath: string | null = null

      // Upload document if courier and file provided
      if (role === 'courier' && documentFile) {
        const formData = new FormData()
        formData.append('file', documentFile)
        formData.append('userId', userId)

        const uploadResponse = await fetch('/api/auth/upload-document', {
          method: 'POST',
          body: formData,
        })

        const uploadData = await uploadResponse.json()
        if (uploadResponse.ok && uploadData.filePath) {
          documentPath = uploadData.filePath
        } else {
          console.error('Document upload failed:', uploadData.error)
          toast.error('Profile saved but document upload failed')
        }
      }

      // Update profile with all collected data
      const updateResponse = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          fullName,
          role,
          address,
          email: role === 'sender' ? email : undefined,
          documentPath,
          documentType,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }
    } catch (err: any) {
      console.error('Error updating profile:', err)
      throw err
    }
  }

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!fullName.trim() || !phoneNumber.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setStep('details')
  }

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate role-specific fields
      if (!address.trim()) {
        setError('Address is required')
        setLoading(false)
        return
      }

      if (role === 'sender' && !email.trim()) {
        setError('Email address is required for senders')
        setLoading(false)
        return
      }

      if (role === 'courier' && !documentFile) {
        setError('Please upload an ID document')
        setLoading(false)
        return
      }

      // Format phone number
      const formatted = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber}`

      // Send OTP
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formatted, isSignup: true }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.userExists) {
          setError('')
          toast.error('An account already exists with this phone number. Please sign in instead.', {
            duration: 5000,
          })
          setTimeout(() => {
            router.push('/login')
          }, 2000)
          return
        }
        throw new Error(data.error || 'Failed to send OTP')
      }

      toast.success('Verification code sent to your WhatsApp!')
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
      toast.error(err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formatted = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber}`

      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: formatted,
          otp: otp,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP')
      }

      // Upload document if courier (using admin client, so no auth needed)
      let documentPath: string | null = null
      if (role === 'courier' && documentFile && data.user?.id) {
        try {
          const uploadFormData = new FormData()
          uploadFormData.append('file', documentFile)
          uploadFormData.append('userId', data.user.id)

          const uploadResponse = await fetch('/api/auth/upload-document', {
            method: 'POST',
            body: uploadFormData,
          })

          const uploadData = await uploadResponse.json()
          if (uploadResponse.ok && uploadData.filePath) {
            documentPath = uploadData.filePath
            console.log('Document uploaded successfully:', documentPath)
          } else {
            console.error('Document upload failed:', uploadData.error)
            toast.error('Document upload failed, but you can upload it later')
          }
        } catch (uploadErr: any) {
          console.error('Document upload error:', uploadErr)
          toast.error('Document upload failed, but you can upload it later')
        }
      }

      // Save form data to localStorage before redirect
      const formDataToSave = {
        fullName,
        phoneNumber: formatted,
        role,
        address,
        email,
        documentType,
        documentPath, // Include uploaded document path if available
      }
      localStorage.setItem('signup_form_data', JSON.stringify(formDataToSave))

      // Redirect to magic link - profile will be updated when redirect completes
      if (data.redirectUrl) {
        toast.success('Verifying...')
        window.location.href = data.redirectUrl
      } else {
        throw new Error('No redirect URL received from server')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
      toast.error(err.message || 'Verification failed')
      setLoading(false)
    }
  }

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a JPEG, PNG, or PDF file')
        return
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }
      setDocumentFile(file)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="flex justify-center mb-2">
          <Image 
            src="/logo.jpeg" 
            alt="QikParcel Logo" 
            width={200} 
            height={200}
            priority
            className="object-contain"
          />
        </div>
        <h2 className="text-4xl font-bold text-center mb-8" style={{ color: '#29772F' }}>
          {step === 'basic' && 'Sign up'}
          {step === 'details' && (role === 'sender' ? 'Sender Details' : 'Courier Details')}
          {step === 'otp' && 'Verify your phone number'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'basic' && (
          <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
              <p className="mt-1 text-xs text-gray-500">
                Include country code. We&apos;ll send verification code via WhatsApp
              </p>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                I am a *
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'sender' | 'courier')}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              >
                <option value="sender">Sender (I want to send parcels)</option>
                <option value="courier">Courier (I want to deliver parcels)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: '#29772F' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f5f25'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#29772F'}
            >
              {loading ? 'Processing...' : 'Next'}
            </button>
          </form>
        )}

        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your full address"
                rows={3}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

            {role === 'sender' && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            )}

            {role === 'courier' && (
              <>
                <div>
                  <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-2">
                    ID Document Type *
                  </label>
                  <select
                    id="documentType"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  >
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver&apos;s License</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-2">
                    Upload ID Document * (JPEG, PNG, or PDF, max 5MB)
                  </label>
                  <input
                    type="file"
                    id="document"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={handleDocumentChange}
                    required={!documentFile}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                  {documentFile && (
                    <p className="mt-1 text-xs text-green-600">
                      Selected: {documentFile.name} ({(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('basic')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: '#29772F' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f5f25'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#29772F'}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest text-black"
              />
              <p className="mt-2 text-sm text-gray-600">
                We sent a code to {phoneNumber} via WhatsApp
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="flex-1 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: '#29772F' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f5f25'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#29772F'}
              >
                {loading ? 'Verifying...' : 'Verify & Sign Up'}
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                setLoading(true)
                try {
                  const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`
                  const response = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: formatted, isSignup: true }),
                  })
                  if (response.ok) {
                    toast.success('Verification code resent!')
                  } else {
                    const data = await response.json()
                    toast.error(data.error || 'Failed to resend code')
                  }
                } catch (err) {
                  toast.error('Failed to resend code')
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="w-full text-sm disabled:opacity-50"
              style={{ color: '#29772F' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1f5f25'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#29772F'}
            >
              Resend Code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#29772F' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
