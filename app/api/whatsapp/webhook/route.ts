import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * POST /api/whatsapp/webhook
 * Webhook endpoint to receive WhatsApp messages from Twilio
 * 
 * Twilio sends POST requests to this endpoint when:
 * - A message is received
 * - Message status changes (sent, delivered, read, failed)
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends form data, not JSON
    const formData = await request.formData()
    
    const messageSid = formData.get('MessageSid') as string
    const accountSid = formData.get('AccountSid') as string
    const from = formData.get('From') as string // whatsapp:+1234567890
    const to = formData.get('To') as string // whatsapp:+1234567890
    const body = formData.get('Body') as string
    const messageStatus = formData.get('MessageStatus') as string // queued, sent, delivered, read, failed
    const numMedia = formData.get('NumMedia') as string

    // Verify this is from Twilio (optional but recommended)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
    if (accountSid !== twilioAccountSid) {
      console.error('Invalid Twilio account SID')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Handle incoming message
    if (body && from) {
      // Remove 'whatsapp:' prefix if present
      const fromPhone = from.replace('whatsapp:', '')
      const toPhone = to.replace('whatsapp:', '')

      console.log('Received WhatsApp message:', {
        messageSid,
        from: fromPhone,
        to: toPhone,
        body,
        status: messageStatus,
      })

      // TODO: Process message and link to parcel thread
      // This will be implemented in Milestone 5
      // 
      // Steps:
      // 1. Find or create message_thread by phone number
      // 2. Link to parcel if exists
      // 3. Save message to messages table
      // 4. Process command if it's a command ("status", "help", etc.)
      // 5. Send response if needed

      // For now, just acknowledge receipt
      const supabase = createSupabaseAdminClient()
      
      // Save message to database (basic implementation)
      // Full implementation in Milestone 5
    }

    // Handle message status updates
    if (messageStatus && messageSid) {
      console.log('Message status update:', {
        messageSid,
        status: messageStatus,
      })

      // TODO: Update message status in database
      // This will be implemented in Milestone 5
    }

    // Twilio expects TwiML response or 200 OK
    // For now, return empty TwiML response
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * GET /api/whatsapp/webhook
 * Health check endpoint (Twilio doesn't use GET, but useful for testing)
 */
export async function GET(request: NextRequest) {
  return new NextResponse(
    JSON.stringify({ status: 'ok', message: 'WhatsApp webhook is active' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
