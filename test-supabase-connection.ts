#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const databaseUrl = process.env.DATABASE_URL!

async function testSupabaseConnection() {
  console.log('🔍 Teste Supabase-Verbindung...\n')

  let allTestsPassed = true

  // Test 1: Supabase API Connection (Anon Key)
  console.log('1️⃣  Teste Supabase API Verbindung (Anon Key)...')
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.from('bills').select('count', { count: 'exact', head: true })

    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (which is ok for this test)
      throw error
    }

    console.log('   ✅ Supabase API Verbindung erfolgreich')
    console.log(`   📊 URL: ${supabaseUrl}\n`)
  } catch (error) {
    console.log('   ❌ Supabase API Verbindung fehlgeschlagen')
    console.log(`   Fehler: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`)
    allTestsPassed = false
  }

  // Test 2: Supabase Service Role Connection
  console.log('2️⃣  Teste Supabase Service Role Verbindung...')
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data, error } = await supabaseAdmin.from('bills').select('count', { count: 'exact', head: true })

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    console.log('   ✅ Service Role Verbindung erfolgreich\n')
  } catch (error) {
    console.log('   ❌ Service Role Verbindung fehlgeschlagen')
    console.log(`   Fehler: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`)
    allTestsPassed = false
  }

  // Test 3: Database Connection (PostgreSQL)
  console.log('3️⃣  Teste direkte PostgreSQL Datenbankverbindung...')
  try {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    })

    const client = await pool.connect()
    const result = await client.query('SELECT version()')
    client.release()
    await pool.end()

    console.log('   ✅ PostgreSQL Verbindung erfolgreich')
    console.log(`   📦 PostgreSQL Version: ${result.rows[0].version.split(',')[0]}\n`)
  } catch (error) {
    console.log('   ❌ PostgreSQL Verbindung fehlgeschlagen')
    console.log(`   Fehler: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`)
    allTestsPassed = false
  }

  // Test 4: Supabase Storage Connection
  console.log('4️⃣  Teste Supabase Storage Verbindung...')
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets()

    if (error) {
      throw error
    }

    console.log('   ✅ Storage Verbindung erfolgreich')
    console.log(`   🗄️  Verfügbare Buckets: ${buckets.map(b => b.name).join(', ') || 'keine'}\n`)

    // Check for bill-images bucket
    const billImagesBucket = buckets.find(b => b.name === 'bill-images')
    if (billImagesBucket) {
      console.log('   ✅ "bill-images" Bucket gefunden')
    } else {
      console.log('   ⚠️  "bill-images" Bucket nicht gefunden')
    }
  } catch (error) {
    console.log('   ❌ Storage Verbindung fehlgeschlagen')
    console.log(`   Fehler: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`)
    allTestsPassed = false
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  if (allTestsPassed) {
    console.log('✅ Alle Tests erfolgreich abgeschlossen!')
  } else {
    console.log('❌ Einige Tests sind fehlgeschlagen.')
    process.exit(1)
  }
  console.log('='.repeat(50))
}

// Run tests
testSupabaseConnection().catch(error => {
  console.error('Unerwarteter Fehler:', error)
  process.exit(1)
})
