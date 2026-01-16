import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

/**
 * Create a selection when guest submits payment
 * NOTE: Status remains SELECTING - only payer can mark as paid via mark-paid endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      billId,
      shareToken,
      sessionId,
      friendName,
      itemQuantities,
      tipAmount,
      paymentMethod,
    } = body

    // Validation
    if (!billId || !shareToken || !sessionId || !friendName || !itemQuantities || !paymentMethod) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate UUID
    if (!/^[a-f0-9-]{36}$/i.test(billId) || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Validate share token
    if (!/^[a-f0-9-]{36}$/i.test(shareToken)) {
      return NextResponse.json(
        { error: 'Ungültiger Share Token' },
        { status: 400 }
      )
    }

    // Verify bill exists and token matches
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('id, shareToken')
      .eq('id', billId)
      .single()

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    if (bill.shareToken !== shareToken) {
      return NextResponse.json(
        { error: 'Ungültiger Share Token' },
        { status: 403 }
      )
    }

    // Sanitize friend name
    const sanitizedName = sanitizeInput(friendName, 100)
    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Name ist ungültig' },
        { status: 400 }
      )
    }

    // Validate payment method
    if (paymentMethod !== 'PAYPAL' && paymentMethod !== 'CASH') {
      return NextResponse.json(
        { error: 'Ungültige Zahlungsmethode' },
        { status: 400 }
      )
    }

    // Validate tip amount
    const validatedTipAmount = typeof tipAmount === 'number' && tipAmount >= 0 && tipAmount < 10000
      ? tipAmount
      : 0

    // Validate item quantities
    if (typeof itemQuantities !== 'object' || Object.keys(itemQuantities).length === 0) {
      return NextResponse.json(
        { error: 'Keine Positionen ausgewählt' },
        { status: 400 }
      )
    }

    // Calculate total amount for response
    let totalAmount = validatedTipAmount

    // Fetch item prices to calculate total
    const itemIds = Object.keys(itemQuantities)
    if (itemIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('BillItem')
        .select('id, pricePerUnit')
        .eq('billId', billId)
        .in('id', itemIds)

      if (itemsError) {
        throw itemsError
      }

      items?.forEach((item) => {
        const quantity = itemQuantities[item.id] || 0
        totalAmount += item.pricePerUnit * quantity
      })
    }

    // Check if there's already a SELECTING selection for this session
    const { data: existingSelection, error: fetchError } = await supabaseAdmin
      .from('Selection')
      .select('id')
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .eq('status', 'SELECTING')
      .single()

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let selectionId: string

    if (existingSelection) {
      // Update existing SELECTING selection (convert to "submitted" but keep status=SELECTING)
      selectionId = existingSelection.id

      const { error: updateError } = await supabaseAdmin
        .from('Selection')
        .update({
          friendName: sanitizedName,
          itemQuantities,
          tipAmount: validatedTipAmount,
          paymentMethod,
          paid: false, // Not paid until payer confirms
          expiresAt,
          updatedAt: now,
        })
        .eq('id', selectionId)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new selection with status=SELECTING
      selectionId = crypto.randomUUID()

      const { error: insertError } = await supabaseAdmin
        .from('Selection')
        .insert({
          id: selectionId,
          billId,
          sessionId,
          friendName: sanitizedName,
          itemQuantities,
          tipAmount: validatedTipAmount,
          paymentMethod,
          status: 'SELECTING', // Stays SELECTING until payer marks as paid
          paid: false,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      selectionId,
      totalAmount,
      paymentMethod,
    })
  } catch (error) {
    console.error('Error creating selection:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Auswahl' },
      { status: 500 }
    )
  }
}
