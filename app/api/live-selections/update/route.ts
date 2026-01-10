import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, itemId, guestName, quantity } = body

    // Validation
    if (!billId || !itemId || !guestName || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate UUIDs
    if (!/^[a-f0-9-]{36}$/i.test(billId) || !/^[a-f0-9-]{36}$/i.test(itemId)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Validate quantity
    if (quantity < 0 || quantity > 10) {
      return NextResponse.json(
        { error: 'Ungültige Menge' },
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

    // Set expiration to 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Check if entry exists
    const { data: existing } = await supabaseAdmin
      .from('ActiveSelection')
      .select('id')
      .eq('billId', billId)
      .eq('itemId', itemId)
      .eq('guestName', sanitizedName)
      .single()

    if (existing) {
      // Update existing entry
      const { error: updateError } = await supabaseAdmin
        .from('ActiveSelection')
        .update({
          quantity,
          expiresAt,
        })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new entry
      const { error: insertError } = await supabaseAdmin
        .from('ActiveSelection')
        .insert({
          id: crypto.randomUUID(),
          billId,
          itemId,
          guestName: sanitizedName,
          quantity,
          expiresAt,
        })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating live selection:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Live-Auswahl' },
      { status: 500 }
    )
  }
}
