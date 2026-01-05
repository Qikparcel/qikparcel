'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function CancellationPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-3">
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
            href="/dashboard"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Cancellation Policy</h1>
          </div>
          <p className="text-gray-600">
            Last updated: 01/03/2026
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 md:p-8">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <div className="mb-8">
              <p className="text-gray-700 leading-relaxed mb-4">
                This Cancellation Policy explains when and how deliveries on the QikParcel platform may be cancelled, and how refunds (if any) are handled.
              </p>
              <p className="text-gray-700 leading-relaxed">
                QikParcel is a technology platform connecting senders with independent travellers. This policy applies to all users of the platform.
              </p>
            </div>

            {/* Section 1: Who Can Cancel */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Who Can Cancel a Delivery</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                A delivery may be cancelled by:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>The sender</li>
                <li>The traveller (courier)</li>
                <li>QikParcel (in limited circumstances)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Cancellations are subject to the delivery stage at the time of cancellation.
              </p>
            </div>

            {/* Section 2: Cancellation Stages & Refunds */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">2. Cancellation Stages & Refunds</h2>
              
              <div className="space-y-6">
                {/* 2.1 Pending */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Pending (Not Yet Matched)</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Status:</strong> Pending</p>
                    <p><strong>Who can cancel:</strong> Sender</p>
                    <p><strong>Refund:</strong> Full refund</p>
                    <p className="mt-3">
                      The delivery may be cancelled at any time before a traveller is matched, with no penalty.
                    </p>
                  </div>
                </div>

                {/* 2.2 Matched */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Matched (Before Pickup)</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Status:</strong> Matched</p>
                    <p><strong>Who can cancel:</strong> Sender or traveller</p>
                    <p><strong>Refund:</strong> Full refund</p>
                    <p className="mt-3">
                      If a delivery is cancelled after matching but before pickup, the sender receives a full refund. No payment is released to the traveller.
                    </p>
                  </div>
                </div>

                {/* 2.3 Picked Up */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">2.3 Picked Up (After Pickup)</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Status:</strong> Picked Up / In Transit</p>
                    <p><strong>Who can cancel:</strong> Sender, traveller, or QikParcel</p>
                    <p><strong>Refund:</strong> Partial or no refund</p>
                    <p className="mt-3 mb-2">
                      Once a parcel has been picked up:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>The traveller has already committed time and travel</li>
                      <li>Operational costs may have been incurred</li>
                    </ul>
                    <p className="mt-3">
                      Refunds at this stage are assessed on a case-by-case basis and may be reduced or withheld.
                    </p>
                  </div>
                </div>

                {/* 2.4 Delivered */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">2.4 Delivered</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Status:</strong> Delivered</p>
                    <p><strong>Who can cancel:</strong> No one</p>
                    <p><strong>Refund:</strong> Not applicable</p>
                    <p className="mt-3">
                      Once a parcel is marked as delivered and confirmed, the delivery is complete and cannot be cancelled.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Traveller-Initiated Cancellations */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Traveller-Initiated Cancellations</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                A traveller may cancel a delivery if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>The parcel appears unsafe or prohibited</li>
                <li>The sender provides inaccurate or misleading information</li>
                <li>Circumstances beyond the traveller's control prevent completion</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mb-2">
                In such cases:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>The sender may receive a partial or full refund depending on the situation</li>
                <li>QikParcel may remove or restrict travellers who repeatedly cancel without valid reasons</li>
              </ul>
            </div>

            {/* Section 4: Platform-Initiated Cancellations */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Platform-Initiated Cancellations</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                QikParcel may cancel a delivery if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Platform rules or laws are violated</li>
                <li>Fraud, misuse, or prohibited items are suspected</li>
                <li>Safety or compliance concerns arise</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Refunds, if any, will be determined based on the delivery stage and circumstances.
              </p>
            </div>

            {/* Section 5: How Refunds Are Processed */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. How Refunds Are Processed</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Approved refunds are processed to the original payment method</li>
                <li>Refund timelines depend on payment providers and banks</li>
                <li>QikParcel does not control external processing delays</li>
              </ul>
            </div>

            {/* Section 6: No Circumvention */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. No Circumvention</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Users must not attempt to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Complete deliveries outside the platform</li>
                <li>Exchange payment directly</li>
                <li>Bypass escrow protections</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Doing so may result in account suspension or termination.
              </p>
            </div>

            {/* Section 7: Disputes */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Disputes</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                If a cancellation leads to a dispute:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Funds remain held securely</li>
                <li>QikParcel investigates based on platform data and records</li>
                <li>Decisions are final and binding under this policy</li>
              </ul>
            </div>

            {/* Section 8: Policy Updates */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Policy Updates</h2>
              <p className="text-gray-700 leading-relaxed">
                QikParcel may update this Cancellation Policy from time to time. Continued use of the platform constitutes acceptance of the updated policy.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

