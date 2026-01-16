import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, quantity, pricePerUnit } = body

    // Validate ID format (UUID)
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Ungültige ID' },
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

    // Owner can always edit items, even if selections exist
    // Guests' selections will adjust automatically to the new values

    // Calculate new total price
    const totalPrice = quantity * pricePerUnit

    // Update bill item
    const { data: item, error } = await supabaseAdmin
      .from('BillItem')
      .update({
        name: name.trim(),
        quantity,
        pricePerUnit,
        totalPrice
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!item) {
      return NextResponse.json(
        { error: 'Position nicht gefunden' },
        { status: 404 }
      )
    }

    // Realtime events are automatically triggered by Supabase postgres_changes
    // No manual broadcast needed - clients subscribed to BillItem table will receive UPDATE event

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Error updating bill item:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Validate ID format (UUID)
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Ungültige ID' },
        { status: 400 }
      )
    }

    // Owner can always delete items, even if selections exist
    // Selections referencing this item will still have the itemId in their itemQuantities,
    // but the item won't exist anymore (handled gracefully in frontend)

    // Delete bill item
    const { error } = await supabaseAdmin
      .from('BillItem')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    // Realtime events are automatically triggered by Supabase postgres_changes
    // No manual broadcast needed - clients subscribed to BillItem table will receive DELETE event

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bill item:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen' },
      { status: 500 }
    )
  }
}
