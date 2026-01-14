// Quick test to see if Supabase connection works
import { supabaseAdmin } from './lib/supabase'
import { randomUUID } from 'crypto'

async function testConnection() {
  console.log('Testing Supabase connection...')

  try {
    // Test 1: Simple select
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('Bill')
      .select('*')
      .limit(1)

    if (tablesError) {
      console.error('❌ Error selecting from Bill:', tablesError)
    } else {
      console.log('✅ SELECT works, found', tables?.length || 0, 'bills')
    }

    // Test 2: Try to insert
    const testBill = {
      id: randomUUID(),
      payerName: 'Test',
      paypalHandle: 'test',
      imageUrl: '',
      shareToken: randomUUID(),
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('Bill')
      .insert(testBill)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error inserting into Bill:', insertError)
      console.error('Error code:', insertError.code)
      console.error('Error details:', insertError.details)
      console.error('Error hint:', insertError.hint)
    } else {
      console.log('✅ INSERT works, created bill:', inserted.id)

      // Cleanup - delete test bill
      await supabaseAdmin.from('Bill').delete().eq('id', inserted.id)
      console.log('✅ Cleaned up test bill')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testConnection()
