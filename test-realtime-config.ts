/**
 * Test script to verify Supabase Realtime configuration
 * Run with: npx ts-node test-realtime-config.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🔍 Testing Supabase Realtime Configuration\n')
console.log('URL:', SUPABASE_URL)
console.log('Anon Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testRealtimeConfig() {
  try {
    console.log('📡 Testing Realtime subscription for ActiveSelection...\n')

    // Test ActiveSelection subscription
    const channel1 = supabase
      .channel('test-active-selection')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ActiveSelection'
        },
        (payload) => {
          console.log('✅ ActiveSelection event received:', payload)
        }
      )
      .subscribe((status) => {
        console.log('📡 ActiveSelection subscription status:', status)
      })

    // Test Selection subscription
    const channel2 = supabase
      .channel('test-selection')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Selection'
        },
        (payload) => {
          console.log('✅ Selection event received:', payload)
        }
      )
      .subscribe((status) => {
        console.log('📡 Selection subscription status:', status)
      })

    console.log('\n⏳ Waiting 5 seconds for subscription confirmation...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('✅ Test completed!')
    console.log('\n📝 Next steps:')
    console.log('1. Check above for subscription status (should be "SUBSCRIBED")')
    console.log('2. In Supabase Dashboard, go to Database > Publications')
    console.log('3. Verify that "supabase_realtime" publication includes:')
    console.log('   - ActiveSelection table')
    console.log('   - Selection table')
    console.log('4. If tables are missing, click "Edit publication" and add them')

    // Cleanup
    await supabase.removeChannel(channel1)
    await supabase.removeChannel(channel2)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testRealtimeConfig()
