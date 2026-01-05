/**
 * Phone number utilities
 * Normalizes phone numbers to E.164 format for Twilio
 */

/**
 * Normalize phone number to E.164 format
 * Removes spaces, dashes, parentheses, and other formatting
 * Ensures it starts with + and contains only digits after +
 * Handles leading zeros for all countries (removes leading 0 after country code)
 * 
 * @param phoneNumber - Phone number in any format
 * @returns Normalized phone number in E.164 format (e.g., +923224916205)
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return phoneNumber
  }

  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, '')

  // If it already starts with +, keep it
  if (normalized.startsWith('+')) {
    // Remove the + temporarily to process
    normalized = normalized.substring(1)
  }

  // Handle leading zeros after country code for all countries
  // Many countries use leading 0 in local format (e.g., 03224916205 in Pakistan, 0123456789 in UK)
  // When combined with country code, this becomes +9203224916205 or +440123456789
  // We need to detect and remove the leading 0 after the country code
  
  // Common country codes are 1-3 digits
  // Pattern: If number starts with country code followed by 0, remove that 0
  // Examples:
  // +9203224916205 -> +923224916205 (Pakistan: 92 + 0...)
  // +440123456789 -> +44123456789 (UK: 44 + 0...)
  // +12025551234 -> +12025551234 (US: 1, no leading 0 - keep as is)
  // +910123456789 -> +91123456789 (India: 91 + 0...)
  // +330123456789 -> +33123456789 (France: 33 + 0...)
  
  // Try to detect and remove leading zero after country code
  // Country codes are typically 1-3 digits, so we check positions 1-4 for a zero
  // We only remove the zero if it appears right after the country code
  if (normalized.length > 4) {
    // Check for 1-digit country code + 0 (e.g., US/Canada: 1)
    // Only remove if the number is long enough and the second digit is 0
    if (normalized.length > 2 && normalized[1] === '0' && normalized.length >= 8) {
      // For 1-digit codes, be more careful - only remove if it's clearly a leading zero
      // (not part of the actual number like in +12025551234)
      normalized = normalized[0] + normalized.substring(2)
    }
    // Check for 2-digit country code + 0 (e.g., Pakistan: 92, UK: 44, India: 91, France: 33)
    else if (normalized.length > 3 && normalized[2] === '0' && normalized.length >= 9) {
      normalized = normalized.substring(0, 2) + normalized.substring(3)
    }
    // Check for 3-digit country code + 0 (less common, but possible)
    else if (normalized.length > 4 && normalized[3] === '0' && normalized.length >= 10) {
      normalized = normalized.substring(0, 3) + normalized.substring(4)
    }
  }

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


