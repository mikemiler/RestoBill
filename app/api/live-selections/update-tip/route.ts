import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

/**
 * Update ONLY the tip amount for a live selection (SELECTING status)
 * Separate endpoint to avoid issues with item quantity logic
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, sessionId, guestName, tipAmount } = body

    // Validation
    if (!billId || !sessionId || !guestName) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate tipAmount (required for this endpoint)
    if (typeof tipAmount !== 'number' || tipAmount < 0 || tipAmount > 10000) {
      return NextResponse.json(
        { error: 'Ungültiger Trinkgeldbetrag' },
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

    // Sanitize guestName
    const sanitizedName = sanitizeInput(guestName, 100)
    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Name ist ungültig' },
        { status: 400 }
      )
    }

    // Set expiration to 30 days from now
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Get or create Selection with status=SELECTING
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('Selection')
      .select('id, itemQuantities')
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .eq('status', 'SELECTING')
      .single()

    if (existing) {
      // Update existing Selection - only tip amount
      const { error: updateError } = await supabaseAdmin
        .from('Selection')
        .update({
          friendName: sanitizedName,
          tipAmount: tipAmount,
          expiresAt,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new Selection with tip only (empty itemQuantities)
      const now = new Date().toISOString()
      const { error: insertError } = await supabaseAdmin
        .from('Selection')
        .insert({
          id: crypto.randomUUID(),
          billId,
          sessionId,
          friendName: sanitizedName,
          itemQuantities: {}, // Empty - tip only
          status: 'SELECTING',
          tipAmount: tipAmount,
          paymentMethod: null,  // NULL = guest is still selecting (not yet submitted)
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
    console.error('Error updating tip:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Trinkgelds' },
      { status: 500 }
    )
  }
}
