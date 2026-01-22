import { NextRequest, NextResponse } from 'next/server'
import { createWhatsAppClient } from '@/lib/whatsapp/client'

// Mark route as dynamic since it uses searchParams
export const dynamic = 'force-dynamic'

/**
 * GET /api/whatsapp/check-status?messageSid=SMxxxxx
 * Check the status of a WhatsApp message
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const messageSid = searchParams.get('messageSid')

    if (!messageSid) {
      return NextResponse.json(
        { error: 'Missing messageSid query parameter' },
        { status: 400 }
      )
    }

    const client = createWhatsAppClient()
    const result = await client.getMessageStatus(messageSid)

    return NextResponse.json({
      success: true,
      messageSid: result.sid,
      status: result.status,
      errorCode: result.error_code || null,
      errorMessage: result.error_message || null,
      dateSent: result.date_sent,
      dateUpdated: result.date_updated,
      to: result.to,
      from: result.from,
      body: result.body,
    })
  } catch (error: any) {
    console.error('Check status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check message status' },
      { status: 500 }
    )
  }
}

