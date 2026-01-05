'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase/client'

export default function TermsPage() {
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  const documents = [
    {
      title: 'Privacy Policy',
      description: 'General privacy policy applicable to all users',
      file: '/QikParcel Privacy Policy 2026.pdf',
      show: true, // Show to all users
    },
    {
      title: 'Sender Terms and Conditions',
      description: 'Terms and conditions specific to senders',
      file: '/QikParcel Sender Terms and Conditions 2026.pdf',
      show: profile?.role === 'sender' || profile?.role === 'admin',
    },
    {
      title: 'Courier Terms and Conditions',
      description: 'Terms and conditions specific to couriers',
      file: '/QikParcel Courier Terms and Conditions 2026.pdf',
      show: profile?.role === 'courier' || profile?.role === 'admin',
    },
  ]

  const visibleDocuments = documents.filter(doc => doc.show)

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
          <h1 className="text-3xl font-bold text-gray-900">Terms and Conditions</h1>
          <p className="mt-2 text-gray-600">
            Review the terms and conditions applicable to your account
          </p>
        </div>

        <div className="space-y-6">
          {visibleDocuments.map((doc, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{doc.title}</h2>
                  <p className="text-sm text-gray-600">{doc.description}</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {/* PDF Viewer */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    src={`${doc.file}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-[600px]"
                    title={doc.title}
                  />
                </div>

                {/* Download Button */}
                <div className="flex justify-end">
                  <a
                    href={doc.file}
                    download
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                    style={{ backgroundColor: '#29772F' }}
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download PDF
                  </a>
                </div>
              </div>
            </div>
          ))}

          {visibleDocuments.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-600">
                No terms and conditions documents available for your account type.
              </p>
            </div>
          )}

          {/* Additional Resources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Link
              href="/terms/faq"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h2>
              <p className="text-sm text-gray-600 mb-4">
                Find answers to common questions about QikParcel
              </p>
              <span className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center">
                View FAQ
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </Link>

            <Link
              href="/terms/cancellation"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cancellation Policy</h2>
              <p className="text-sm text-gray-600 mb-4">
                Learn about cancellation terms and refund policies
              </p>
              <span className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center">
                View Policy
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}



