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

    // Check if item has any selections
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('Selection')
      .select('id, itemQuantities')
      .eq('billId', (await supabaseAdmin
        .from('BillItem')
        .select('billId')
        .eq('id', id)
        .single()
      ).data?.billId)

    if (selectionsError) {
      throw selectionsError
    }

    // Check if this item is referenced in any selection
    const hasSelections = selections?.some((selection: any) => {
      const quantities = selection.itemQuantities as Record<string, number> || {}
      return quantities[id] && quantities[id] > 0
    })

    if (hasSelections) {
      return NextResponse.json(
        { error: 'Diese Position kann nicht bearbeitet werden, da bereits Auswahlen dafür existieren' },
        { status: 409 }
      )
    }

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

    // Check if item has any selections
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('Selection')
      .select('id, itemQuantities')
      .eq('billId', (await supabaseAdmin
        .from('BillItem')
        .select('billId')
        .eq('id', id)
        .single()
      ).data?.billId)

    if (selectionsError) {
      throw selectionsError
    }

    // Check if this item is referenced in any selection
    const hasSelections = selections?.some((selection: any) => {
      const quantities = selection.itemQuantities as Record<string, number> || {}
      return quantities[id] && quantities[id] > 0
    })

    if (hasSelections) {
      return NextResponse.json(
        { error: 'Diese Position kann nicht gelöscht werden, da bereits Auswahlen dafür existieren' },
        { status: 409 }
      )
    }

    // Delete bill item
    const { error } = await supabaseAdmin
      .from('BillItem')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bill item:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen' },
      { status: 500 }
    )
  }
}
