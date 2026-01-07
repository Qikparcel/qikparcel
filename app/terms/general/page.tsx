'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function GeneralTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/login" className="flex items-center gap-3">
                <Image
                  src="/logo.jpeg"
                  alt="QikParcel Logo"
                  width={40}
                  height={40}
                  className="rounded"
                />
                <h1 className="text-xl font-bold text-gray-800">QikParcel</h1>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/login"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Login
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-gray-600">
            General privacy policy applicable to all users
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {/* PDF Viewer */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <iframe
                src="/QikParcel Privacy Policy 2026.pdf#toolbar=1&navpanes=1&scrollbar=1"
                className="w-full h-[600px]"
                title="Privacy Policy"
              />
            </div>

            {/* Download Button */}
            <div className="flex justify-end">
              <a
                href="/QikParcel Privacy Policy 2026.pdf"
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
      </main>
    </div>
  )
}




