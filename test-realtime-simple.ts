/**
 * Simple Supabase Realtime Test
 * Tests if realtime is enabled for ActiveSelection and Selection tables
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testRealtime() {
  console.log('🧪 Testing Supabase Realtime Connection...\n')

  console.log('📡 Subscribing to ActiveSelection changes...')

  const channel = supabase
    .channel('test-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ActiveSelection'
      },
      (payload) => {
        console.log('✅ Realtime event received (ActiveSelection):', payload)
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Selection'
      },
      (payload) => {
        console.log('✅ Realtime event received (Selection):', payload)
      }
    )
    .subscribe((status, err) => {
      console.log('Channel status:', status)
      if (err) {
        console.error('❌ Subscription error:', err)
      } else if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime channel!')
        console.log('\n👉 Now try to:')
        console.log('   1. Open http://localhost:3000/split/[token] in your browser')
        console.log('   2. Select some items')
        console.log('   3. Watch this console for realtime events\n')
        console.log('Press Ctrl+C to exit\n')
      }
    })

  // Keep script running
  process.stdin.resume()
}

testRealtime().catch(console.error)
