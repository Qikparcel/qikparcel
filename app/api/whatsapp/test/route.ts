import { NextRequest, NextResponse } from 'next/server'
import { createWhatsAppClient } from '@/lib/whatsapp/client'

/**
 * POST /api/whatsapp/test
 * Test endpoint to send a WhatsApp message
 * 
 * ⚠️ Remove this in production or add authentication!
 */
export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json()

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing "to" or "message" in request body' },
        { status: 400 }
      )
    }

    const client = createWhatsAppClient()
    const result = await client.sendTextMessage(to, message)

    return NextResponse.json({
      success: true,
      messageSid: result.sid,
      status: result.status,
    })
  } catch (error: any) {
    console.error('Test message error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/test/template
 * Test endpoint to send a template message using Content API
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const to = searchParams.get('to')
  const contentSid = process.env.TWILIO_CONTENT_SID

  if (!to) {
    return NextResponse.json(
      { error: 'Missing "to" query parameter' },
      { status: 400 }
    )
  }

  if (!contentSid) {
    return NextResponse.json(
      { error: 'TWILIO_CONTENT_SID not configured' },
      { status: 500 }
    )
  }

  try {
    const client = createWhatsAppClient()
    const result = await client.sendContentTemplate(
      to,
      contentSid,
      { "1": "12/1", "2": "3pm" } // Example variables
    )

    return NextResponse.json({
      success: true,
      messageSid: result.sid,
      status: result.status,
    })
  } catch (error: any) {
    console.error('Test template error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send template' },
      { status: 500 }
    )
  }
}

