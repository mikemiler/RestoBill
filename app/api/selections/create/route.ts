import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generatePayPalUrl, sanitizeInput } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, shareToken, sessionId, friendName, itemQuantities, tipAmount, paymentMethod } = body

    // Validation
    if (!billId || !shareToken || !friendName || !itemQuantities) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Validate payment method
    if (paymentMethod && paymentMethod !== 'PAYPAL' && paymentMethod !== 'CASH') {
      return NextResponse.json(
        { error: 'Ungültige Zahlungsmethode' },
        { status: 400 }
      )
    }

    // Validate billId and shareToken format (UUID)
    const uuidRegex = /^[a-f0-9-]{36}$/i
    if (!uuidRegex.test(billId) || !uuidRegex.test(shareToken)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Validate sessionId format if provided (optional but recommended)
    if (sessionId && !uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Ungültige SessionId Format' },
        { status: 400 }
      )
    }

    // Sanitize friendName to prevent XSS
    const sanitizedName = sanitizeInput(friendName, 100)
    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Name ist ungültig' },
        { status: 400 }
      )
    }

    // Validate itemQuantities structure
    if (typeof itemQuantities !== 'object' || Array.isArray(itemQuantities)) {
      return NextResponse.json(
        { error: 'Ungültige Datenstruktur' },
        { status: 400 }
      )
    }

    // Verify share token
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('*, BillItem(*)')
      .eq('id', billId)
      .eq('shareToken', shareToken)
      .single()

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    // Calculate total amount
    let totalAmount = 0
    const selectedItemIds: string[] = []

    for (const [itemId, quantity] of Object.entries(itemQuantities)) {
      // Validate quantity
      if (typeof quantity !== 'number' || quantity < 0 || quantity > 10) {
        return NextResponse.json(
          { error: 'Ungültige Menge' },
          { status: 400 }
        )
      }

      const item = bill.BillItem.find((i: any) => i.id === itemId)
      if (item && quantity > 0) {
        totalAmount += item.pricePerUnit * quantity
        selectedItemIds.push(itemId)
      }
    }

    // Validate and add tip
    const tip = typeof tipAmount === 'number' ? tipAmount : 0
    if (tip < 0 || tip > 10000) {
      return NextResponse.json(
        { error: 'Ungültiger Trinkgeldbetrag' },
        { status: 400 }
      )
    }
    totalAmount += tip

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Gesamtbetrag muss größer als 0 sein' },
        { status: 400 }
      )
    }

    if (totalAmount > 100000) {
      return NextResponse.json(
        { error: 'Betrag zu hoch' },
        { status: 400 }
      )
    }

    // Create selection in database
    const selectionId = crypto.randomUUID()
    const { data: selection, error: selectionError } = await supabaseAdmin
      .from('Selection')
      .insert({
        id: selectionId,
        billId: billId,
        sessionId: sessionId || null,
        friendName: sanitizedName,
        itemQuantities: itemQuantities,
        tipAmount: tip,
        paymentMethod: paymentMethod || 'PAYPAL',
      })
      .select()
      .single()

    if (selectionError) {
      throw selectionError
    }

    // For cash payment, no PayPal URL needed
    if (paymentMethod === 'CASH') {
      return NextResponse.json({
        selectionId: selection.id,
        totalAmount,
        paymentMethod: 'CASH',
      })
    }

    // Generate PayPal.me URL for PayPal payment
    const paypalUrl = generatePayPalUrl(bill.paypalHandle, totalAmount)

    return NextResponse.json({
      selectionId: selection.id,
      totalAmount,
      paymentMethod: 'PAYPAL',
      paypalUrl,
    })
  } catch (error) {
    console.error('Error creating selection:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Auswahl' },
      { status: 500 }
    )
  }
}
