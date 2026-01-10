import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🔍 Testing Supabase Realtime...')
console.log('URL:', supabaseUrl)
console.log('Key:', supabaseAnonKey ? '✓ Set' : '✗ Missing')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test 1: Check if ActiveSelection table exists
async function testTableExists() {
  console.log('\n📋 Test 1: Check ActiveSelection table...')
  const { data, error } = await supabase
    .from('ActiveSelection')
    .select('count')
    .limit(1)

  if (error) {
    console.error('❌ Error:', error.message)
    console.error('Details:', error)
  } else {
    console.log('✅ Table exists and is accessible')
  }
}

// Test 2: Try to subscribe to realtime
async function testRealtime() {
  console.log('\n🔴 Test 2: Subscribe to Realtime channel...')

  const channel = supabase
    .channel('test-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ActiveSelection'
      },
      (payload) => {
        console.log('✅ Received realtime update:', payload)
      }
    )
    .subscribe((status) => {
      console.log('Channel status:', status)
    })

  console.log('Channel created, waiting 5 seconds...')

  setTimeout(() => {
    console.log('Unsubscribing...')
    supabase.removeChannel(channel)
    process.exit(0)
  }, 5000)
}

testTableExists().then(() => testRealtime())
