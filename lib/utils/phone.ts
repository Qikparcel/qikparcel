/**
 * Phone number utilities
 * Normalizes phone numbers to E.164 format for Twilio
 */

/**
 * Normalize phone number to E.164 format
 * Removes spaces, dashes, parentheses, and other formatting
 * Ensures it starts with + and contains only digits after +
 * 
 * @param phoneNumber - Phone number in any format
 * @returns Normalized phone number in E.164 format (e.g., +37256129522)
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return phoneNumber
  }

  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, '')

  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`
  }

  return normalized
}

/**
 * Format phone number for Twilio WhatsApp
 * Adds whatsapp: prefix if not present
 * 
 * @param phoneNumber - Phone number (will be normalized)
 * @returns Formatted phone number for Twilio (e.g., whatsapp:+37256129522)
 */
export function formatPhoneForTwilio(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber)
  
  if (normalized.startsWith('whatsapp:')) {
    return normalized
  }
  
  return `whatsapp:${normalized}`
}

/**
 * Normalize phone number for comparison
 * Removes + and other formatting for consistent comparison
 * 
 * @param phoneNumber - Phone number in any format
 * @returns Phone number with only digits (e.g., 37256129522)
 */
export function normalizePhoneForComparison(phoneNumber: string): string {
  if (!phoneNumber) {
    return ''
  }
  // Remove all non-digit characters including +
  return phoneNumber.replace(/\D/g, '')
}


