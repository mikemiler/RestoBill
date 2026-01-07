import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const databaseUrl = process.env.DATABASE_URL!

interface TestResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: Record<string, unknown>
  error?: string
}

export async function GET() {
  const results: TestResult[] = []
  let allTestsPassed = true

  // Test 1: Supabase API Connection (Anon Key)
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.from('bills').select('count', { count: 'exact', head: true })

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    results.push({
      name: 'Supabase API (Anon Key)',
      status: 'success',
      message: 'Verbindung erfolgreich',
      details: {
        url: supabaseUrl
      }
    })
  } catch (error) {
    allTestsPassed = false
    results.push({
      name: 'Supabase API (Anon Key)',
      status: 'error',
      message: 'Verbindung fehlgeschlagen',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 2: Supabase Service Role Connection
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

    results.push({
      name: 'Supabase Service Role',
      status: 'success',
      message: 'Verbindung erfolgreich'
    })
  } catch (error) {
    allTestsPassed = false
    results.push({
      name: 'Supabase Service Role',
      status: 'error',
      message: 'Verbindung fehlgeschlagen',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 3: Database Connection (PostgreSQL)
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

    const version = result.rows[0].version.split(',')[0]

    results.push({
      name: 'PostgreSQL Database',
      status: 'success',
      message: 'Verbindung erfolgreich',
      details: {
        version
      }
    })
  } catch (error) {
    allTestsPassed = false
    results.push({
      name: 'PostgreSQL Database',
      status: 'error',
      message: 'Verbindung fehlgeschlagen',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 4: Supabase Storage Connection
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

    const billImagesBucket = buckets.find(b => b.name === 'bill-images')

    if (billImagesBucket) {
      results.push({
        name: 'Supabase Storage',
        status: 'success',
        message: 'Verbindung erfolgreich, "bill-images" Bucket gefunden',
        details: {
          buckets: buckets.map(b => b.name)
        }
      })
    } else {
      results.push({
        name: 'Supabase Storage',
        status: 'warning',
        message: 'Verbindung erfolgreich, aber "bill-images" Bucket nicht gefunden',
        details: {
          buckets: buckets.map(b => b.name)
        }
      })
    }
  } catch (error) {
    allTestsPassed = false
    results.push({
      name: 'Supabase Storage',
      status: 'error',
      message: 'Verbindung fehlgeschlagen',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return NextResponse.json({
    success: allTestsPassed,
    timestamp: new Date().toISOString(),
    results
  }, {
    status: allTestsPassed ? 200 : 500
  })
}
