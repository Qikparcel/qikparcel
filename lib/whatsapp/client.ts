/**
 * Twilio WhatsApp API Client
 * Handles all WhatsApp messaging operations via Twilio
 */

import { normalizePhoneNumber, formatPhoneForTwilio } from '@/lib/utils/phone'

interface TwilioConfig {
  accountSid: string
  authToken: string
  messagingServiceSid?: string
  whatsappNumber?: string // Fallback if messaging service is not available
}

class WhatsAppClient {
  private accountSid: string
  private authToken: string
  private messagingServiceSid?: string
  private whatsappNumber?: string
  private twilioApiBase: string

  constructor(config: TwilioConfig) {
    this.accountSid = config.accountSid
    this.authToken = config.authToken
    this.messagingServiceSid = config.messagingServiceSid
    this.whatsappNumber = config.whatsappNumber
    this.twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`
  }

  /**
   * Get the From field value - prefer messaging service SID over phone number
   */
  private getFromField(): string {
    if (this.messagingServiceSid) {
      // Use messaging service SID directly (no whatsapp: prefix needed)
      return this.messagingServiceSid
    }
    if (this.whatsappNumber) {
      // Fallback to phone number with formatting
      return formatPhoneForTwilio(this.whatsappNumber)
    }
    throw new Error('Either messagingServiceSid or whatsappNumber must be provided')
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendTextMessage(to: string, message: string) {
    const url = `${this.twilioApiBase}/Messages.json`

    // Get From field (messaging service SID or phone number)
    const from = this.getFromField()
    const toFormatted = formatPhoneForTwilio(to)

    // Create Basic Auth header
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: toFormatted,
        Body: message,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Twilio API error (${response.status}): ${errorText}`
      
      // Try to parse error for better message
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message) {
          errorMessage = `Twilio API error: ${errorJson.message}`
          if (errorJson.code) {
            errorMessage += ` (Code: ${errorJson.code})`
          }
        }
      } catch (e) {
        // If JSON parse fails, use the text as-is
      }
      
      console.error('Twilio API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        from,
        to: toFormatted,
      })
      
      throw new Error(errorMessage)
    }

    const result = await response.json()
    console.log('Twilio message sent successfully:', {
      messageSid: result.sid,
      status: result.status,
      to: result.to,
    })
    
    return result
  }

  /**
   * Send a media message (image, document, etc.)
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    message?: string
  ) {
    const url = `${this.twilioApiBase}/Messages.json`

    // Get From field (messaging service SID or phone number)
    const from = this.getFromField()
    const toFormatted = formatPhoneForTwilio(to)

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

    const body: any = {
      From: from,
      To: toFormatted,
      MediaUrl: mediaUrl,
    }

    if (message) {
      body.Body = message
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Twilio API error: ${error}`)
    }

    return response.json()
  }

  /**
   * Send a message using Twilio Content API (for templates)
   * @param to - Recipient phone number (with or without whatsapp: prefix)
   * @param contentSid - Content SID from Twilio Content API
   * @param contentVariables - Variables to fill in the template (JSON string or object)
   */
  async sendContentTemplate(
    to: string,
    contentSid: string,
    contentVariables?: string | Record<string, string>
  ) {
    const url = `${this.twilioApiBase}/Messages.json`

    // Get From field (messaging service SID or phone number)
    const from = this.getFromField()
    const toFormatted = formatPhoneForTwilio(to)

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

    const body: any = {
      From: from,
      To: toFormatted,
      ContentSid: contentSid,
    }

    // Handle content variables
    if (contentVariables) {
      if (typeof contentVariables === 'string') {
        body.ContentVariables = contentVariables
      } else {
        body.ContentVariables = JSON.stringify(contentVariables)
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Twilio API error (${response.status}): ${errorText}`
      let userFriendlyMessage = 'Failed to send message'
      let errorCode: string | undefined
      
      // Try to parse error for better message
      try {
        const errorJson = JSON.parse(errorText)
        errorCode = errorJson.code
        if (errorJson.message) {
          errorMessage = `Twilio API error: ${errorJson.message}`
          
          // Handle specific error codes with user-friendly messages
          if (errorJson.code === '21211') {
            // Invalid phone number
            userFriendlyMessage = 'The phone number is not valid. Please check the number and try again.'
            errorMessage = `Invalid phone number: ${errorJson.message}`
          } else if (errorJson.code === '21608') {
            // Unsubscribed recipient
            userFriendlyMessage = 'This phone number is not subscribed to receive WhatsApp messages. Please join the WhatsApp Sandbox or contact support.'
          } else if (errorJson.code === '21610') {
            // Unsubscribed recipient (alternative)
            userFriendlyMessage = 'This phone number is not registered to receive WhatsApp messages. Please ensure you have joined the WhatsApp Sandbox for testing.'
          } else if (errorJson.code === '21614') {
            // Invalid WhatsApp number
            userFriendlyMessage = 'This phone number is not a valid WhatsApp number. Please use a number that has WhatsApp installed.'
          } else {
            // Generic error with code
            userFriendlyMessage = errorJson.message || 'Failed to send message. Please try again later.'
            if (errorJson.code) {
              errorMessage += ` (Code: ${errorJson.code})`
            }
          }
        }
      } catch (e) {
        // If JSON parse fails, use the text as-is
      }
      
      console.error('Twilio Content API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        from,
        to: toFormatted,
        contentSid,
      })
      
      // Create error object with both technical and user-friendly messages
      const error = new Error(errorMessage) as any
      error.userMessage = userFriendlyMessage
      error.code = errorCode
      throw error
    }

    const result = await response.json()
    console.log('Twilio template message sent successfully:', {
      messageSid: result.sid,
      status: result.status,
      to: result.to,
      contentSid,
    })
    
    return result
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string) {
    const url = `${this.twilioApiBase}/Messages/${messageSid}.json`

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Twilio API error: ${error}`)
    }

    return response.json()
  }
}

/**
 * Create WhatsApp client instance using Twilio
 * Uses Messaging Service SID if available, falls back to phone number
 */
export const createWhatsAppClient = (): WhatsAppClient => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken) {
    throw new Error('Missing required Twilio environment variables: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
  }

  if (!messagingServiceSid && !whatsappNumber) {
    throw new Error('Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_WHATSAPP_NUMBER must be provided')
  }

  return new WhatsAppClient({
    accountSid,
    authToken,
    messagingServiceSid,
    whatsappNumber,
  })
}

export { WhatsAppClient }
