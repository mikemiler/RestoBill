import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, name, quantity, pricePerUnit } = body

    // Validate billId
    if (!billId || !/^[a-f0-9-]{36}$/i.test(billId)) {
      return NextResponse.json(
        { error: 'Ungültige Rechnungs-ID' },
        { status: 400 }
      )
    }

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bezeichnung ist erforderlich' },
        { status: 400 }
      )
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'Anzahl muss größer als 0 sein' },
        { status: 400 }
      )
    }

    if (typeof pricePerUnit !== 'number' || pricePerUnit < 0) {
      return NextResponse.json(
        { error: 'Preis muss 0 oder größer sein' },
        { status: 400 }
      )
    }

    // Check if bill exists
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('id')
      .eq('id', billId)
      .single()

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    // Calculate total price
    const totalPrice = quantity * pricePerUnit

    // Generate UUID for item
    const itemId = randomUUID()

    // Create new bill item
    const { data: item, error } = await supabaseAdmin
      .from('BillItem')
      .insert({
        id: itemId,
        billId,
        name: name.trim(),
        quantity,
        pricePerUnit,
        totalPrice
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Realtime events are automatically triggered by Supabase postgres_changes
    // No manual broadcast needed - clients subscribed to BillItem table will receive INSERT event

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (error) {
    console.error('Error creating bill item:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen' },
      { status: 500 }
    )
  }
}
