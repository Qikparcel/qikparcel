'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setProfile(profileData)
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const roleConfig = {
    sender: {
      label: 'Sender',
      description: 'You can create and manage parcel requests',
      icon: '📦',
      color: 'bg-blue-100 text-blue-800',
    },
    courier: {
      label: 'Courier',
      description: 'You can create trips and deliver parcels',
      icon: '🚚',
      color: 'bg-purple-100 text-purple-800',
    },
    admin: {
      label: 'Admin',
      description: 'You have administrative access',
      icon: '👤',
      color: 'bg-green-100 text-green-800',
    },
  }

  const formatAddress = () => {
    if (!profile) return 'Not set'
    
    const parts = []
    if (profile.street_address) parts.push(profile.street_address)
    if (profile.address_line_2) parts.push(profile.address_line_2)
    if (profile.city) parts.push(profile.city)
    if (profile.state) parts.push(profile.state)
    if (profile.postcode) parts.push(profile.postcode)
    if (profile.country) parts.push(profile.country)
    
    return parts.length > 0 ? parts.join(', ') : (profile.address || 'Not set')
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

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Profile not found</p>
          <Link href="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const roleInfo = roleConfig[profile.role as keyof typeof roleConfig] || roleConfig.sender

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
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account information</p>
        </div>

        <div className="space-y-6">
          {/* Account Type / Role Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Type</h2>
            <div className="flex items-center gap-4">
              <div className="text-4xl">{roleInfo.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{roleInfo.description}</p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {profile.full_name || 'Not set'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {profile.phone_number || 'Not set'}
                </dd>
              </div>

              {profile.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.email}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Account Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Address Information</h2>
            <dl className="space-y-4">
              {profile.street_address || profile.address ? (
                <>
                  {profile.street_address && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Street Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.street_address}</dd>
                    </div>
                  )}
                  
                  {profile.address_line_2 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Address Line 2</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.address_line_2}</dd>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.city && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">City</dt>
                        <dd className="mt-1 text-sm text-gray-900">{profile.city}</dd>
                      </div>
                    )}

                    {profile.state && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">State/Province</dt>
                        <dd className="mt-1 text-sm text-gray-900">{profile.state}</dd>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.postcode && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Postcode</dt>
                        <dd className="mt-1 text-sm text-gray-900">{profile.postcode}</dd>
                      </div>
                    )}

                    {profile.country && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Country</dt>
                        <dd className="mt-1 text-sm text-gray-900">{profile.country}</dd>
                      </div>
                    )}
                  </div>

                  {!profile.street_address && profile.address && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.address}</dd>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">No address information available</p>
                </div>
              )}
            </dl>
          </div>

          {/* Additional Info for Couriers */}
          {profile.role === 'courier' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Courier Information</h2>
              <p className="text-sm text-gray-600">
                KYC verification status and courier-specific details will be shown here once implemented.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}


