#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkTables() {
  console.log('🔍 Checking for Prisma tables...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Check for Prisma-style capitalized tables
  const prismaTable = ['Bill', 'BillItem', 'Selection']

  for (const table of prismaTable) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        console.log(`❌ Table "${table}": NOT FOUND`)
      } else {
        console.log(`✅ Table "${table}": EXISTS (Prisma format)`)
      }
    } catch (error) {
      console.log(`❌ Table "${table}": ERROR`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('Prisma creates tables with capitalized names.')
  console.log('We need to use these existing tables instead!')
  console.log('='.repeat(50))
}

checkTables().catch(error => {
  console.error('Check failed:', error)
  process.exit(1)
})
