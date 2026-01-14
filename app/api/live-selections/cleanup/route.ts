import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, sessionId } = body

    // Validation
    if (!billId || !sessionId) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate UUIDs
    const uuidRegex = /^[a-f0-9-]{36}$/i
    if (!uuidRegex.test(billId) || !uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Delete Selection with status=SELECTING for this session on this bill
    const { error: deleteError } = await supabaseAdmin
      .from('Selection')
      .delete()
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .eq('status', 'SELECTING')

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cleaning up live selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aufräumen der Live-Auswahlen' },
      { status: 500 }
    )
  }
}
