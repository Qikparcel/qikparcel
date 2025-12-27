/**
 * Test script for Supabase connection
 * Run with: node scripts/test-supabase.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure .env.local is set up correctly')
  process.exit(1)
}

console.log('🧪 Testing Supabase Connection...\n')
console.log('Configuration:')
console.log(`  URL: ${SUPABASE_URL}`)
console.log(`  Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`)

// Test with anon key
try {
  console.log('📡 Testing connection with anon key...')
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Try to query a table (this will fail if tables don't exist, which is expected)
  const { data, error } = await supabase.from('profiles').select('count').limit(1)
  
  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      console.log('⚠️  Tables not found - this is expected if migrations haven\'t been run yet')
      console.log('✅ Connection successful! Database is ready for migrations.')
    } else {
      console.error('❌ Error:', error.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Connection successful! Tables exist.')
  }
} catch (error) {
  console.error('❌ Connection error:', error.message)
  process.exit(1)
}

// Test with service role key
if (SUPABASE_SERVICE_KEY) {
  try {
    console.log('\n📡 Testing connection with service role key...')
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    
    const { data, error } = await supabaseAdmin.from('profiles').select('count').limit(1)
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('⚠️  Tables not found - run migrations to create them')
        console.log('✅ Service role key is valid!')
      } else {
        console.error('❌ Error:', error.message)
      }
    } else {
      console.log('✅ Service role connection successful!')
    }
  } catch (error) {
    console.error('❌ Service role connection error:', error.message)
  }
}

console.log('\n✅ Supabase connection test complete!')

