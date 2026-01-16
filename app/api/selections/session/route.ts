import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

/**
 * GET /api/selections/session
 * Get all selections for a specific session (browser)
 * Query params: billId, sessionId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const billId = searchParams.get('billId')
    const sessionId = searchParams.get('sessionId')

    // Validation
    if (!billId || !sessionId) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: billId und sessionId erforderlich' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[a-f0-9-]{36}$/i
    if (!uuidRegex.test(billId) || !uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Ungültiges ID Format' },
        { status: 400 }
      )
    }

    // Fetch active selections for this session (status=SELECTING only)
    // These are the guest's current selections (auto-saved in real-time)
    const { data: selections, error } = await supabaseAdmin
      .from('Selection')
      .select('*')
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .eq('status', 'SELECTING')
      .gte('expiresAt', new Date().toISOString()) // Only non-expired
      .order('createdAt', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(selections || [])
  } catch (error) {
    console.error('Error fetching session selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Auswahlen' },
      { status: 500 }
    )
  }
}
