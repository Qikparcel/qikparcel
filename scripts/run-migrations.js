/**
 * Run Supabase database migrations
 * This script executes the SQL migrations using Supabase client
 * Run with: node scripts/run-migrations.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
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

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Read migration files
const migration1Path = join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
const migration2Path = join(__dirname, '..', 'supabase', 'migrations', '002_rls_policies.sql')

const migration1 = readFileSync(migration1Path, 'utf-8')
const migration2 = readFileSync(migration2Path, 'utf-8')

async function runSQL(sql, name) {
  console.log(`\n📦 Running ${name}...`)
  
  try {
    // Use Supabase REST API to execute SQL via rpc
    // Note: Supabase doesn't allow arbitrary SQL via REST API for security
    // We need to use the Management API or SQL Editor
    
    // Try using the Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`   Found ${statements.length} SQL statements`)
    
    // Unfortunately, Supabase REST API doesn't support arbitrary SQL execution
    // We need to use the SQL Editor or Supabase CLI
    
    console.log(`\n⚠️  Direct SQL execution via API is not available for security reasons.`)
    console.log(`\n📋 Please run migrations in Supabase Dashboard:\n`)
    
    console.log(`1. Go to: https://app.supabase.com/project/${SUPABASE_URL.split('//')[1].split('.')[0]}/sql/new`)
    console.log(`2. Copy the SQL from: supabase/migrations/${name}`)
    console.log(`3. Paste into SQL Editor`)
    console.log(`4. Click "Run" button`)
    
    return false
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return false
  }
}

async function checkTables() {
  console.log('\n🔍 Checking if tables exist...')
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    
    // Try to query profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('⚠️  Tables not found - migrations need to be run')
        return false
      }
      throw error
    }
    
    console.log('✅ Tables exist!')
    return true
  } catch (error) {
    console.log('⚠️  Could not check tables automatically')
    return false
  }
}

async function main() {
  console.log('🚀 Running Supabase Migrations')
  console.log(`Project: ${SUPABASE_URL}`)
  console.log('='.repeat(60))
  
  // Check if tables already exist
  const tablesExist = await checkTables()
  
  if (tablesExist) {
    console.log('\n✅ Database tables already exist!')
    console.log('If you need to re-run migrations, do it manually in Supabase Dashboard.')
    return
  }
  
  console.log('\n📝 Migration Instructions:')
  console.log('='.repeat(60))
  
  const projectId = SUPABASE_URL.split('//')[1].split('.')[0]
  const sqlEditorUrl = `https://app.supabase.com/project/${projectId}/sql/new`
  
  console.log('\n🔗 Open SQL Editor:')
  console.log(`   ${sqlEditorUrl}\n`)
  
  console.log('1️⃣  Migration 1: Initial Schema')
  console.log('   File: supabase/migrations/001_initial_schema.sql')
  console.log('   Steps:')
  console.log('   1. Click "New Query" in SQL Editor')
  console.log('   2. Open: supabase/migrations/001_initial_schema.sql')
  console.log('   3. Copy ALL contents (Ctrl+A, Ctrl+C)')
  console.log('   4. Paste into SQL Editor (Ctrl+V)')
  console.log('   5. Click "Run" button (or Cmd/Ctrl + Enter)')
  console.log('   6. Wait for "Success. No rows returned" message\n')
  
  console.log('2️⃣  Migration 2: RLS Policies')
  console.log('   File: supabase/migrations/002_rls_policies.sql')
  console.log('   Steps:')
  console.log('   1. Click "New Query" again')
  console.log('   2. Open: supabase/migrations/002_rls_policies.sql')
  console.log('   3. Copy ALL contents')
  console.log('   4. Paste into SQL Editor')
  console.log('   5. Click "Run" button')
  console.log('   6. Wait for "Success. No rows returned" message\n')
  
  console.log('3️⃣  Verify:')
  console.log('   - Go to Table Editor in Supabase Dashboard')
  console.log('   - Should see 10 tables:')
  console.log('     • profiles')
  console.log('     • parcels')
  console.log('     • trips')
  console.log('     • messages')
  console.log('     • message_threads')
  console.log('     • parcel_trip_matches')
  console.log('     • courier_kyc')
  console.log('     • disputes')
  console.log('     • payouts')
  console.log('     • parcel_status_history\n')
  
  console.log('4️⃣  Test:')
  console.log('   After migrations, run: npm run test:supabase\n')
  
  console.log('='.repeat(60))
  console.log('\n💡 Tip: You can also use Supabase CLI if installed:')
  console.log('   supabase link --project-ref ' + projectId)
  console.log('   supabase db push\n')
  
  // Open the SQL editor URL if possible
  console.log('🌐 Opening SQL Editor in browser...')
  console.log(`   If it doesn't open automatically, go to: ${sqlEditorUrl}\n`)
}

main().catch(console.error)
