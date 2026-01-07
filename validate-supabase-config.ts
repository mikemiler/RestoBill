#!/usr/bin/env ts-node

import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

function validateSupabaseConfig() {
  console.log('🔍 Validiere Supabase-Konfiguration...\n')

  let allValid = true
  const errors: string[] = []
  const warnings: string[] = []

  // Check NEXT_PUBLIC_SUPABASE_URL
  console.log('1️⃣  Prüfe NEXT_PUBLIC_SUPABASE_URL...')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    errors.push('   ❌ NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt')
    allValid = false
  } else if (!supabaseUrl.startsWith('https://')) {
    errors.push('   ❌ NEXT_PUBLIC_SUPABASE_URL muss mit https:// beginnen')
    allValid = false
  } else if (!supabaseUrl.includes('supabase.co')) {
    warnings.push('   ⚠️  URL scheint keine Standard-Supabase-URL zu sein')
  } else {
    console.log(`   ✅ URL ist gültig: ${supabaseUrl}`)

    // Extract project reference
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
    if (match) {
      console.log(`   📦 Projekt-Referenz: ${match[1]}`)
    }
  }
  console.log()

  // Check NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log('2️⃣  Prüfe NEXT_PUBLIC_SUPABASE_ANON_KEY...')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    errors.push('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt')
    allValid = false
  } else if (!anonKey.startsWith('eyJ')) {
    errors.push('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY scheint kein gültiger JWT zu sein')
    allValid = false
  } else {
    console.log('   ✅ Anon Key ist gesetzt')
    console.log(`   🔑 Key-Länge: ${anonKey.length} Zeichen`)

    // Try to decode JWT header
    try {
      const [header] = anonKey.split('.')
      const decoded = JSON.parse(Buffer.from(header, 'base64').toString())
      console.log(`   📋 JWT Algorithmus: ${decoded.alg}`)
    } catch (e) {
      warnings.push('   ⚠️  Konnte JWT nicht dekodieren')
    }
  }
  console.log()

  // Check SUPABASE_SERVICE_ROLE_KEY
  console.log('3️⃣  Prüfe SUPABASE_SERVICE_ROLE_KEY...')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    errors.push('   ❌ SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt')
    allValid = false
  } else if (!serviceKey.startsWith('eyJ')) {
    errors.push('   ❌ SUPABASE_SERVICE_ROLE_KEY scheint kein gültiger JWT zu sein')
    allValid = false
  } else {
    console.log('   ✅ Service Role Key ist gesetzt')
    console.log(`   🔑 Key-Länge: ${serviceKey.length} Zeichen`)

    // Try to decode JWT payload to check role
    try {
      const [, payload] = serviceKey.split('.')
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
      if (decoded.role === 'service_role') {
        console.log('   ✅ JWT hat korrekte service_role')
      } else {
        warnings.push(`   ⚠️  JWT rolle ist '${decoded.role}', nicht 'service_role'`)
      }
    } catch (e) {
      warnings.push('   ⚠️  Konnte JWT-Payload nicht dekodieren')
    }
  }
  console.log()

  // Check DATABASE_URL
  console.log('4️⃣  Prüfe DATABASE_URL...')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    errors.push('   ❌ DATABASE_URL ist nicht gesetzt')
    allValid = false
  } else if (!databaseUrl.startsWith('postgresql://')) {
    errors.push('   ❌ DATABASE_URL muss mit postgresql:// beginnen')
    allValid = false
  } else {
    console.log('   ✅ Database URL ist gesetzt')

    // Parse database URL
    try {
      const url = new URL(databaseUrl)
      console.log(`   🗄️  Host: ${url.hostname}`)
      console.log(`   🔌 Port: ${url.port || 5432}`)
      console.log(`   👤 Benutzer: ${url.username}`)
      console.log(`   📚 Datenbank: ${url.pathname.substring(1)}`)

      // Check if it matches the Supabase project
      if (supabaseUrl && url.hostname.includes(supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '')) {
        console.log('   ✅ Database URL passt zur Supabase-Projekt-URL')
      }
    } catch (e) {
      warnings.push('   ⚠️  Konnte DATABASE_URL nicht parsen')
    }
  }
  console.log()

  // Check consistency
  console.log('5️⃣  Prüfe Konsistenz...')
  if (supabaseUrl && anonKey && serviceKey) {
    try {
      // Extract project ref from URL
      const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
      const projectRef = urlMatch?.[1]

      // Check if JWTs reference the same project
      const [, anonPayload] = anonKey.split('.')
      const [, servicePayload] = serviceKey.split('.')

      const anonDecoded = JSON.parse(Buffer.from(anonPayload, 'base64').toString())
      const serviceDecoded = JSON.parse(Buffer.from(servicePayload, 'base64').toString())

      if (anonDecoded.iss === 'supabase' && serviceDecoded.iss === 'supabase') {
        console.log('   ✅ Beide JWTs sind von Supabase ausgestellt')
      }

      if (anonDecoded.ref === projectRef && serviceDecoded.ref === projectRef) {
        console.log('   ✅ Alle Konfigurationen referenzieren dasselbe Projekt')
      } else {
        warnings.push(`   ⚠️  JWT-Projekt-Referenzen stimmen möglicherweise nicht überein`)
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000)
      if (anonDecoded.exp && anonDecoded.exp < now) {
        errors.push('   ❌ Anon Key ist abgelaufen!')
        allValid = false
      } else if (anonDecoded.exp) {
        const expiryDate = new Date(anonDecoded.exp * 1000)
        console.log(`   📅 Anon Key läuft ab am: ${expiryDate.toLocaleDateString('de-DE')}`)
      }

      if (serviceDecoded.exp && serviceDecoded.exp < now) {
        errors.push('   ❌ Service Role Key ist abgelaufen!')
        allValid = false
      } else if (serviceDecoded.exp) {
        const expiryDate = new Date(serviceDecoded.exp * 1000)
        console.log(`   📅 Service Role Key läuft ab am: ${expiryDate.toLocaleDateString('de-DE')}`)
      }
    } catch (e) {
      warnings.push('   ⚠️  Konnte Konsistenz nicht vollständig prüfen')
    }
  }
  console.log()

  // Print errors and warnings
  if (errors.length > 0) {
    console.log('❌ Fehler gefunden:')
    errors.forEach(err => console.log(err))
    console.log()
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnungen:')
    warnings.forEach(warn => console.log(warn))
    console.log()
  }

  // Summary
  console.log('='.repeat(70))
  if (allValid && errors.length === 0) {
    console.log('✅ Supabase-Konfiguration ist gültig!')
    console.log()
    console.log('ℹ️  Hinweis: Die tatsächliche Verbindung konnte nicht getestet werden,')
    console.log('   da diese Umgebung keine ausgehenden Verbindungen zu Supabase erlaubt.')
    console.log('   Die Konfiguration sollte jedoch in einer produktiven Umgebung')
    console.log('   (z.B. Vercel, lokale Entwicklung) funktionieren.')
  } else {
    console.log('❌ Supabase-Konfiguration hat Probleme!')
    console.log('   Bitte beheben Sie die oben genannten Fehler.')
    process.exit(1)
  }
  console.log('='.repeat(70))
}

// Run validation
validateSupabaseConfig()
