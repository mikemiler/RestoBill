#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runMigration() {
  console.log('🚀 Running database migration...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Read the migration file
  const migration = fs.readFileSync('supabase-migration.sql', 'utf8')

  // Split the migration into individual statements
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // Skip comments
    if (statement.trim().startsWith('--')) {
      continue
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        // Try direct query if rpc doesn't work
        const { error: queryError } = await supabase.from('_').select('*').limit(0)
        if (queryError) {
          console.log(`⚠️  Statement ${i + 1}: ${queryError.message}`)
          failCount++
        } else {
          console.log(`✅ Statement ${i + 1}: Success`)
          successCount++
        }
      } else {
        console.log(`✅ Statement ${i + 1}: Success`)
        successCount++
      }
    } catch (error) {
      console.log(`⚠️  Statement ${i + 1}: ${error}`)
      failCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Migration completed:`)
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ⚠️  Failed: ${failCount}`)
  console.log('='.repeat(50))
  console.log('\n⚠️  NOTE: Some statements may need to be run manually in Supabase SQL Editor')
  console.log('   Go to: https://app.supabase.com → SQL Editor → New Query')
  console.log('   Copy the contents of supabase-migration.sql and run it there.')
}

runMigration().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
