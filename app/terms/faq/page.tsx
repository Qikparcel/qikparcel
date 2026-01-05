'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function FAQPage() {
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
            <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
          </div>
          <p className="text-gray-600">
            Last updated: 01/03/2026
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 md:p-8">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What is QikParcel?</h2>
              <p className="text-gray-700 leading-relaxed">
                QikParcel is an AI-powered delivery platform that connects people who need to send parcels with trusted travellers already heading in the same direction. Instead of running empty vehicles, we use real journeys — making deliveries faster, cheaper, and more eco-friendly.
              </p>
            </div>

            {/* For Senders Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">For Senders</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How does QikParcel work for sending a parcel?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    You create a parcel request with pickup and delivery details. QikParcel matches your parcel with a verified traveller. Once picked up, you can track the parcel until it is delivered.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2 font-medium">
                    Simple. Transparent. Tracked.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    What can I send?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    You can send every day, non-restricted items such as documents, gifts, clothing, electronics (non-hazardous), and personal items.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    You cannot send prohibited or dangerous items. These are clearly listed in our{' '}
                    <Link href="/terms/prohibited-items" className="text-primary-600 hover:text-primary-700 underline">
                      Prohibited Items Policy
                    </Link>.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How do I know my parcel is safe?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Safety is layered:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Verified travellers only</li>
                    <li>Identity and route checks</li>
                    <li>Secure in-app tracking</li>
                    <li>Escrow-based payment protection</li>
                    <li>Delivery confirmation required</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Can I track my parcel?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Yes. You will see real-time status updates:
                  </p>
                  <p className="text-gray-700 leading-relaxed font-medium">
                    Pending → Matched → Picked Up → In Transit → Delivered
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2">
                    Every step is logged.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    What happens if something goes wrong?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    If there is a delay, issue, or dispute:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>The delivery is paused</li>
                    <li>Our support team investigates</li>
                    <li>Funds remain protected until resolution</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3 font-medium">
                    We do not disappear when things get complicated.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Can I cancel a delivery?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Yes.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Before pickup: full refund</li>
                    <li>After pickup: refunds depend on delivery stage and costs already incurred</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3">
                    Details are outlined clearly in our{' '}
                    <Link href="/terms/cancellation" className="text-primary-600 hover:text-primary-700 underline">
                      Cancellation Policy
                    </Link>.
                  </p>
                </div>
              </div>
            </div>

            {/* For Travellers / Couriers Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">For Travellers / Couriers</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Who can become a QikParcel traveller?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Anyone who:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Is 18+</li>
                    <li>Has valid ID</li>
                    <li>Passes verification checks</li>
                    <li>Is already travelling (walking, driving, cycling, or flying)</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3">
                    You are not an employee. You are an independent traveller using the platform.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How do I earn money?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    You earn by carrying parcels along routes you are already taking. No shifts. No quotas. No fixed hours.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2 font-medium">
                    Complete delivery → confirmation logged → payment released weekly.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Do I need special insurance?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    No additional insurance is required to join. However, travellers must act responsibly and comply with platform rules and local laws.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    What if a sender gives me a prohibited item?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    You must refuse pickup and report it immediately in the app. You will not be penalised for refusing unsafe or illegal items.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Am I an employee of QikParcel?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    No. QikParcel is a technology platform, not a delivery employer. Travellers operate independently and choose when, where, and whether to carry parcels.
                  </p>
                </div>
              </div>
            </div>

            {/* Payments & Pricing Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Payments & Pricing</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How much does QikParcel cost?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Pricing is based on:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Distance</li>
                    <li>Parcel size</li>
                    <li>Route demand</li>
                    <li>Delivery urgency</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3 font-medium">
                    You will see the full price before confirming. No surprise fees.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How are payments handled?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Sender payments are held securely in escrow. Funds are only released once delivery is confirmed.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2">
                    This protects both senders and travellers.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How do travellers get paid?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    After successful delivery and confirmation, payments are released automatically to the traveller account.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2 font-medium">
                    No chasing. No awkward conversations.
                  </p>
                </div>
              </div>
            </div>

            {/* Trust, Safety & Privacy Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Trust, Safety & Privacy</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How are users verified?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    We use identity checks, activity monitoring, and behavioural safeguards to ensure only trusted users operate on the platform.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2 font-medium">
                    Bad actors do not last long here.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Is my data safe?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Yes. QikParcel complies with GDPR and applicable UK & EU data protection laws. We collect only what is necessary and never sell personal data.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Does QikParcel inspect parcels?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Travellers are not required to open parcels. Senders are legally responsible for the contents they declare.
                  </p>
                  <p className="text-gray-700 leading-relaxed mt-2">
                    Random checks may occur to maintain platform safety.
                  </p>
                </div>
              </div>
            </div>

            {/* Environment & Impact Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Environment & Impact</h2>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  How is QikParcel eco-friendly?
                </h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  We do not create new delivery journeys. We use journeys that are already happening.
                </p>
                <p className="text-gray-700 leading-relaxed mb-2">
                  That means:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Fewer vehicles on the road</li>
                  <li>Lower emissions</li>
                  <li>Smarter logistics</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-3 font-medium">
                  Efficiency is sustainability.
                </p>
              </div>
            </div>

            {/* Support Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Support</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    How do I contact support?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Support is available via:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>In-app chat</li>
                    <li>WhatsApp</li>
                    <li>Email</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3 font-medium">
                    If something matters, we respond.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    What if I have feedback or suggestions?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    We actively use user feedback to improve the platform. Smart platforms evolve. Static ones die.
                  </p>
                </div>
              </div>
            </div>

            {/* Legal & Compliance Section */}
            <div className="mb-8 border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Legal & Compliance</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Is QikParcel legal?
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Yes. QikParcel operates as a technology marketplace and complies with applicable platform, consumer, and data protection laws in each region it serves.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Where can I find the Terms & Policies?
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    All legal documents are available on our website and in the app, including:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
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
                  <p className="text-gray-700 leading-relaxed mt-3 font-medium">
                    No hidden rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

