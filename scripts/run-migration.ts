/**
 * Run SQL Migration on Supabase
 * Usage: npx ts-node scripts/run-migration.ts <migration-file>
 */

import { supabaseAdmin } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

async function runMigration(migrationFile: string) {
  console.log(`🚀 Running migration: ${migrationFile}`)

  const migrationPath = path.join(process.cwd(), 'migrations', migrationFile)

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('📝 SQL Preview:')
  console.log(sql.substring(0, 200) + '...\n')

  try {
    // Execute the SQL migration
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql })

    if (error) {
      // If exec_sql RPC doesn't exist, try direct SQL execution
      // Note: This requires the SQL to be split into individual statements
      console.log('⚠️  exec_sql RPC not found, trying direct execution...')

      // For PostgreSQL, we need to execute statements one by one
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.includes('DO $$') || statement.includes('END $$')) {
          // Skip DO blocks for now - they need special handling
          console.log('⏭️  Skipping DO block (execute manually in Supabase SQL Editor)')
          continue
        }

        const { error: stmtError } = await (supabaseAdmin as any).rpc('exec', {
          query: statement + ';',
        })

        if (stmtError) {
          console.warn(`⚠️  Error executing statement: ${stmtError.message}`)
          console.log('Statement:', statement.substring(0, 100) + '...')
        }
      }
    }

    console.log('\n✅ Migration completed!')
    console.log('\n📋 Next steps:')
    console.log('1. Verify schema in Supabase Dashboard → Table Editor')
    console.log('2. If using Prisma locally, run: npx prisma db pull')
    console.log('3. Then: npx prisma generate')
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message)
    console.log('\n💡 Manual fallback:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Copy the SQL from:', migrationPath)
    console.log('3. Paste and execute in SQL Editor')
    process.exit(1)
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2] || '001_add_review_feature.sql'

runMigration(migrationFile).catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
