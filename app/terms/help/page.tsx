'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function HelpPage() {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
          <p className="mt-2 text-gray-600">
            Frequently Asked Questions and Cancellation Policy
          </p>
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Need help?</strong> Contact our support team at{' '}
              <a
                href="mailto:support@qikparcel.com"
                className="text-primary-600 hover:text-primary-700 underline font-medium"
              >
                support@qikparcel.com
              </a>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FAQ Column */}
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
              <p className="text-sm text-gray-600 mt-1">Last updated: 01/03/2026</p>
            </div>

            <div className="prose prose-sm max-w-none max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Introduction */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What is QikParcel?</h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  QikParcel is an AI-powered delivery platform that connects people who need to send parcels with trusted travellers already heading in the same direction. Instead of running empty vehicles, we use real journeys — making deliveries faster, cheaper, and more eco-friendly.
                </p>
              </div>

              {/* For Senders Section */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">For Senders</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How does QikParcel work for sending a parcel?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      You create a parcel request with pickup and delivery details. QikParcel matches your parcel with a verified traveller. Once picked up, you can track the parcel until it's delivered.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      Simple. Transparent. Tracked.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      What can I send?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      You can send every day, non-restricted items such as documents, gifts, clothing, electronics (non-hazardous), and personal items.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      You cannot send prohibited or dangerous items. These are clearly listed in our{' '}
                      <Link href="/terms/prohibited-items" className="text-primary-600 hover:text-primary-700 underline">
                        Prohibited Items Policy
                      </Link>.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How do I know my parcel is safe?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-2">
                      Safety is layered:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2">
                      <li>Verified travellers only</li>
                      <li>Identity and route checks</li>
                      <li>Secure in-app tracking</li>
                      <li>Escrow-based payment protection</li>
                      <li>Delivery confirmation required</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Can I track my parcel?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Yes. You'll see real-time status updates:
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium mb-1">
                      Pending → Matched → Picked Up → In Transit → Delivered
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Every step is logged.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      What happens if something goes wrong?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      If there's a delay, issue, or dispute:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                      <li>The delivery is paused</li>
                      <li>Our support team investigates</li>
                      <li>Funds remain protected until resolution</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      We don't disappear when things get complicated.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Can I cancel a delivery?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Yes.
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                      <li>Before pickup: full refund</li>
                      <li>After pickup: refunds depend on delivery stage and costs already incurred</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Details are outlined clearly in our Cancellation Policy (see right column).
                    </p>
                  </div>
                </div>
              </div>

              {/* For Travellers Section */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">For Travellers / Couriers</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Who can become a QikParcel traveller?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Anyone who:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                      <li>Is 18+</li>
                      <li>Has valid ID</li>
                      <li>Passes verification checks</li>
                      <li>Is already travelling (walking, driving, cycling, or flying)</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      You're not an employee. You're an independent traveller using the platform.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How do I earn money?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      You earn by carrying parcels along routes you're already taking. No shifts. No quotas. No fixed hours.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      Complete delivery → confirmation logged → payment released weekly.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Do I need special insurance?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      No additional insurance is required to join. However, travellers must act responsibly and comply with platform rules and local laws.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      What if a sender gives me a prohibited item?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      You must refuse pickup and report it immediately in the app. You will not be penalised for refusing unsafe or illegal items.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Am I an employee of QikParcel?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      No. QikParcel is a technology platform, not a delivery employer. Travellers operate independently and choose when, where, and whether to carry parcels.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payments & Pricing */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payments & Pricing</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How much does QikParcel cost?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Pricing is based on:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                      <li>Distance</li>
                      <li>Parcel size</li>
                      <li>Route demand</li>
                      <li>Delivery urgency</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      You'll see the full price before confirming. No surprise fees.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How are payments handled?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Sender payments are held securely in escrow. Funds are only released once delivery is confirmed.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      This protects both senders and travellers.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How do travellers get paid?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      After successful delivery and confirmation, payments are released automatically to the traveller's account.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      No chasing. No awkward conversations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust, Safety & Privacy */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Trust, Safety & Privacy</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How are users verified?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      We use identity checks, activity monitoring, and behavioural safeguards to ensure only trusted users operate on the platform.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      Bad actors don't last long here.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Is my data safe?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Yes. QikParcel complies with GDPR and applicable UK & EU data protection laws. We collect only what's necessary and never sell personal data.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Does QikParcel inspect parcels?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Travellers are not required to open parcels. Senders are legally responsible for the contents they declare.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Random checks may occur to maintain platform safety.
                    </p>
                  </div>
                </div>
              </div>

              {/* Environment & Impact */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Environment & Impact</h3>
                
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-2">
                    How is QikParcel eco-friendly?
                  </h4>
                  <p className="text-gray-700 leading-relaxed text-sm mb-1">
                    We don't create new delivery journeys. We use journeys that are already happening.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-sm mb-1">
                    That means:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                    <li>Fewer vehicles on the road</li>
                    <li>Lower emissions</li>
                    <li>Smarter logistics</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed text-sm font-medium">
                    Efficiency is sustainability.
                  </p>
                </div>
              </div>

              {/* Support */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Support</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      How do I contact support?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      Support is available via:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-2">
                      <li>In-app chat</li>
                      <li>WhatsApp</li>
                      <li>
                        Email:{' '}
                        <a
                          href="mailto:support@qikparcel.com"
                          className="text-primary-600 hover:text-primary-700 underline"
                        >
                          support@qikparcel.com
                        </a>
                      </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium">
                      If something matters, we respond.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      What if I have feedback or suggestions?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      We actively use user feedback to improve the platform. Smart platforms evolve. Static ones die.
                    </p>
                  </div>
                </div>
              </div>

              {/* Legal & Compliance */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal & Compliance</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Is QikParcel legal?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Yes. QikParcel operates as a technology marketplace and complies with applicable platform, consumer, and data protection laws in each region it serves.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      Where can I find the Terms & Policies?
                    </h4>
                    <p className="text-gray-700 leading-relaxed text-sm mb-1">
                      All legal documents are available on our website and in the app, including:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2">
                      <li>
                        <Link href="/terms/general" className="text-primary-600 hover:text-primary-700 underline">
                          Terms & Conditions
                        </Link>
                      </li>
                      <li>
                        <Link href="/terms/general" className="text-primary-600 hover:text-primary-700 underline">
                          Privacy Policy
                        </Link>
                      </li>
                      <li>
                        <Link href="/terms/prohibited-items" className="text-primary-600 hover:text-primary-700 underline">
                          Prohibited Items Policy
                        </Link>
                      </li>
                      <li>
                        <Link href="/terms/cancellation" className="text-primary-600 hover:text-primary-700 underline">
                          Cancellation Policy
                        </Link>
                      </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed text-sm font-medium mt-2">
                      No hidden rules.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cancellation Policy Column */}
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Cancellation Policy</h2>
              <p className="text-sm text-gray-600 mt-1">Last updated: 01/03/2026</p>
            </div>

            <div className="prose prose-sm max-w-none max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Introduction */}
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed text-sm mb-3">
                  This Cancellation Policy explains when and how deliveries on the QikParcel platform may be cancelled, and how refunds (if any) are handled.
                </p>
                <p className="text-gray-700 leading-relaxed text-sm">
                  QikParcel is a technology platform connecting senders with independent travellers. This policy applies to all users of the platform.
                </p>
              </div>

              {/* Section 1: Who Can Cancel */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Who Can Cancel a Delivery</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-2">
                  A delivery may be cancelled by:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-3">
                  <li>The sender</li>
                  <li>The traveller (courier)</li>
                  <li>QikParcel (in limited circumstances)</li>
                </ul>
                <p className="text-gray-700 leading-relaxed text-sm">
                  Cancellations are subject to the delivery stage at the time of cancellation.
                </p>
              </div>

              {/* Section 2: Cancellation Stages & Refunds */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Cancellation Stages & Refunds</h3>
                
                <div className="space-y-4">
                  {/* 2.1 Pending */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">2.1 Pending (Not Yet Matched)</h4>
                    <div className="space-y-1 text-gray-700 text-sm">
                      <p><strong>Status:</strong> Pending</p>
                      <p><strong>Who can cancel:</strong> Sender</p>
                      <p><strong>Refund:</strong> Full refund</p>
                      <p className="mt-2">
                        The delivery may be cancelled at any time before a traveller is matched, with no penalty.
                      </p>
                    </div>
                  </div>

                  {/* 2.2 Matched */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">2.2 Matched (Before Pickup)</h4>
                    <div className="space-y-1 text-gray-700 text-sm">
                      <p><strong>Status:</strong> Matched</p>
                      <p><strong>Who can cancel:</strong> Sender or traveller</p>
                      <p><strong>Refund:</strong> Full refund</p>
                      <p className="mt-2">
                        If a delivery is cancelled after matching but before pickup, the sender receives a full refund. No payment is released to the traveller.
                      </p>
                    </div>
                  </div>

                  {/* 2.3 Picked Up */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">2.3 Picked Up (After Pickup)</h4>
                    <div className="space-y-1 text-gray-700 text-sm">
                      <p><strong>Status:</strong> Picked Up / In Transit</p>
                      <p><strong>Who can cancel:</strong> Sender, traveller, or QikParcel</p>
                      <p><strong>Refund:</strong> Partial or no refund</p>
                      <p className="mt-2 mb-1">
                        Once a parcel has been picked up:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>The traveller has already committed time and travel</li>
                        <li>Operational costs may have been incurred</li>
                      </ul>
                      <p className="mt-2">
                        Refunds at this stage are assessed on a case-by-case basis and may be reduced or withheld.
                      </p>
                    </div>
                  </div>

                  {/* 2.4 Delivered */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">2.4 Delivered</h4>
                    <div className="space-y-1 text-gray-700 text-sm">
                      <p><strong>Status:</strong> Delivered</p>
                      <p><strong>Who can cancel:</strong> No one</p>
                      <p><strong>Refund:</strong> Not applicable</p>
                      <p className="mt-2">
                        Once a parcel is marked as delivered and confirmed, the delivery is complete and cannot be cancelled.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Traveller-Initiated Cancellations */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Traveller-Initiated Cancellations</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-2">
                  A traveller may cancel a delivery if:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-3">
                  <li>The parcel appears unsafe or prohibited</li>
                  <li>The sender provides inaccurate or misleading information</li>
                  <li>Circumstances beyond the traveller's control prevent completion</li>
                </ul>
                <p className="text-gray-700 leading-relaxed text-sm mb-1">
                  In such cases:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2">
                  <li>The sender may receive a partial or full refund depending on the situation</li>
                  <li>QikParcel may remove or restrict travellers who repeatedly cancel without valid reasons</li>
                </ul>
              </div>

              {/* Section 4: Platform-Initiated Cancellations */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Platform-Initiated Cancellations</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-2">
                  QikParcel may cancel a delivery if:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-3">
                  <li>Platform rules or laws are violated</li>
                  <li>Fraud, misuse, or prohibited items are suspected</li>
                  <li>Safety or compliance concerns arise</li>
                </ul>
                <p className="text-gray-700 leading-relaxed text-sm">
                  Refunds, if any, will be determined based on the delivery stage and circumstances.
                </p>
              </div>

              {/* Section 5: How Refunds Are Processed */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">5. How Refunds Are Processed</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2">
                  <li>Approved refunds are processed to the original payment method</li>
                  <li>Refund timelines depend on payment providers and banks</li>
                  <li>QikParcel does not control external processing delays</li>
                </ul>
              </div>

              {/* Section 6: No Circumvention */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">6. No Circumvention</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-2">
                  Users must not attempt to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2 mb-3">
                  <li>Complete deliveries outside the platform</li>
                  <li>Exchange payment directly</li>
                  <li>Bypass escrow protections</li>
                </ul>
                <p className="text-gray-700 leading-relaxed text-sm">
                  Doing so may result in account suspension or termination.
                </p>
              </div>

              {/* Section 7: Disputes */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Disputes</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-2">
                  If a cancellation leads to a dispute:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-2">
                  <li>Funds remain held securely</li>
                  <li>QikParcel investigates based on platform data and records</li>
                  <li>Decisions are final and binding under this policy</li>
                </ul>
              </div>

              {/* Section 8: Policy Updates */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Policy Updates</h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  QikParcel may update this Cancellation Policy from time to time. Continued use of the platform constitutes acceptance of the updated policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

