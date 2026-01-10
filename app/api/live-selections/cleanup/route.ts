import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, guestName } = body

    // Validation
    if (!billId || !guestName) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate UUID
    if (!/^[a-f0-9-]{36}$/i.test(billId)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Sanitize guestName
    const sanitizedName = sanitizeInput(guestName, 100)
    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Name ist ungültig' },
        { status: 400 }
      )
    }

    // Delete all active selections for this guest on this bill
    const { error: deleteError } = await supabaseAdmin
      .from('ActiveSelection')
      .delete()
      .eq('billId', billId)
      .eq('guestName', sanitizedName)

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
