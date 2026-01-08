#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkTables() {
  console.log('🔍 Checking database tables...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const tables = ['bills', 'bill_items', 'selections']

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        console.log(`❌ Table "${table}": NOT FOUND (${error.message})`)
      } else {
        console.log(`✅ Table "${table}": EXISTS`)
      }
    } catch (error) {
      console.log(`❌ Table "${table}": ERROR - ${error}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('If tables are missing, run the SQL in supabase-migration.sql')
  console.log('in your Supabase dashboard SQL Editor.')
  console.log('='.repeat(50))
}

checkTables().catch(error => {
  console.error('Check failed:', error)
  process.exit(1)
})
