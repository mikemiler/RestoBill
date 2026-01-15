import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, itemId, sessionId, guestName, quantity } = body

    // Validation
    if (!billId || !itemId || !sessionId || !guestName || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate UUIDs (billId, itemId, sessionId)
    const uuidRegex = /^[a-f0-9-]{36}$/i
    if (!uuidRegex.test(billId) || !uuidRegex.test(itemId) || !uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Validate quantity (basic range check first)
    if (quantity < 0) {
      return NextResponse.json(
        { error: 'Ungültige Menge' },
        { status: 400 }
      )
    }

    // Get the item to validate against its actual quantity
    const { data: item, error: itemError } = await supabaseAdmin
      .from('BillItem')
      .select('quantity, name')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Position nicht gefunden' },
        { status: 404 }
      )
    }

    // Validate quantity against item's actual quantity
    if (quantity > item.quantity) {
      return NextResponse.json(
        { error: `Ungültige Menge für ${item.name} (max. ${item.quantity} verfügbar)` },
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

    // Set expiration to 30 days from now (long-lived for multi-day bill splitting)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Get or create Selection with status=SELECTING
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('Selection')
      .select('id, itemQuantities')
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .eq('status', 'SELECTING')
      .single()

    // Parse existing item quantities or start fresh
    let itemQuantities: Record<string, number> = {}
    if (existing && existing.itemQuantities) {
      itemQuantities = existing.itemQuantities as Record<string, number>
    }

    // Update quantity for this item
    if (quantity === 0) {
      // Remove item from selection
      delete itemQuantities[itemId]
    } else {
      // Add or update item quantity
      itemQuantities[itemId] = quantity
    }

    if (existing) {
      // Update existing Selection (keep row even if empty to preserve tip)
      const { error: updateError } = await supabaseAdmin
        .from('Selection')
        .update({
          friendName: sanitizedName, // Update name if changed
          itemQuantities, // Can be empty {} - preserves tipAmount
          expiresAt,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Don't create new Selection if no items (edge case: should not happen)
      if (Object.keys(itemQuantities).length === 0) {
        return NextResponse.json({ success: true })
      }
      // Create new Selection with status=SELECTING
      const now = new Date().toISOString()
      const { error: insertError } = await supabaseAdmin
        .from('Selection')
        .insert({
          id: crypto.randomUUID(),
          billId,
          sessionId,
          friendName: sanitizedName,
          itemQuantities,
          status: 'SELECTING',
          tipAmount: 0,
          paymentMethod: 'PAYPAL',
          paid: false,
          expiresAt,
          createdAt: now,
          updatedAt: now,
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
