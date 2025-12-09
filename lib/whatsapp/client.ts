/**
 * Twilio WhatsApp API Client
 * Handles all WhatsApp messaging operations via Twilio
 */

interface TwilioConfig {
  accountSid: string
  authToken: string
  whatsappNumber: string
}

class WhatsAppClient {
  private accountSid: string
  private authToken: string
  private whatsappNumber: string
  private twilioApiBase: string

  constructor(config: TwilioConfig) {
    this.accountSid = config.accountSid
    this.authToken = config.authToken
    this.whatsappNumber = config.whatsappNumber
    this.twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendTextMessage(to: string, message: string) {
    const url = `${this.twilioApiBase}/Messages.json`

    // Format phone number (ensure it starts with whatsapp:)
    const from = this.whatsappNumber.startsWith('whatsapp:')
      ? this.whatsappNumber
      : `whatsapp:${this.whatsappNumber}`
    
    const toFormatted = to.startsWith('whatsapp:')
      ? to
      : `whatsapp:${to}`

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
      const error = await response.text()
      throw new Error(`Twilio API error: ${error}`)
    }

    return response.json()
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

    const from = this.whatsappNumber.startsWith('whatsapp:')
      ? this.whatsappNumber
      : `whatsapp:${this.whatsappNumber}`
    
    const toFormatted = to.startsWith('whatsapp:')
      ? to
      : `whatsapp:${to}`

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

    const from = this.whatsappNumber.startsWith('whatsapp:')
      ? this.whatsappNumber
      : `whatsapp:${this.whatsappNumber}`
    
    const toFormatted = to.startsWith('whatsapp:')
      ? to
      : `whatsapp:${to}`

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
      const error = await response.text()
      throw new Error(`Twilio API error: ${error}`)
    }

    return response.json()
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
 */
export const createWhatsAppClient = (): WhatsAppClient => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !whatsappNumber) {
    throw new Error('Missing Twilio environment variables')
  }

  return new WhatsAppClient({
    accountSid,
    authToken,
    whatsappNumber,
  })
}

export { WhatsAppClient }
