/**
 * Test script for WhatsApp integration
 * Run with: node scripts/test-whatsapp.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local')
const envFile = readFileSync(envPath, 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

// Set environment variables
Object.assign(process.env, envVars)

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER
const TEST_NUMBER = process.argv[2] || '+923224916205'

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
  console.error('❌ Missing Twilio environment variables')
  console.error('Make sure .env.local is set up correctly')
  process.exit(1)
}

console.log('🧪 Testing WhatsApp Integration...\n')
console.log('Configuration:')
console.log(`  Account SID: ${TWILIO_ACCOUNT_SID.substring(0, 10)}...`)
console.log(`  WhatsApp Number: ${TWILIO_WHATSAPP_NUMBER}`)
console.log(`  Test Number: ${TEST_NUMBER}\n`)

const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

const body = new URLSearchParams({
  From: TWILIO_WHATSAPP_NUMBER,
  To: TEST_NUMBER.startsWith('whatsapp:') ? TEST_NUMBER : `whatsapp:${TEST_NUMBER}`,
  Body: '🧪 Test message from QikParcel MVP! This is a test of the WhatsApp integration.',
})

try {
  console.log('📤 Sending test message...')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Error:', error)
    process.exit(1)
  }

  const result = await response.json()
  console.log('✅ Message sent successfully!')
  console.log('\nResponse:')
  console.log(`  Message SID: ${result.sid}`)
  console.log(`  Status: ${result.status}`)
  console.log(`  To: ${result.to}`)
  console.log(`  From: ${result.from}`)
  console.log('\n💡 Check your WhatsApp to see the message!')
} catch (error) {
  console.error('❌ Error sending message:', error.message)
  process.exit(1)
}

