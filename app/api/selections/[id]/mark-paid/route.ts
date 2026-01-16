import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Mark a selection as paid by payer (only sets paid=true)
 * Status always remains SELECTING - the paid flag is what matters
 * POST = confirm payment received, DELETE = unconfirm payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Validate UUID
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Get the selection to verify it exists
    const { data: selection, error: fetchError } = await supabaseAdmin
      .from('Selection')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !selection) {
      return NextResponse.json(
        { error: 'Selection nicht gefunden' },
        { status: 404 }
      )
    }

    // Verify it's a SELECTING selection (guest has submitted payment)
    // Note: Status never changes to PAID anymore - it stays SELECTING
    if (selection.status !== 'SELECTING') {
      return NextResponse.json(
        { error: 'Kann nur eingereichte Zahlungen markieren (Status muss SELECTING sein)' },
        { status: 400 }
      )
    }

    // Update ONLY the paid flag (status remains SELECTING)
    const { error: updateError } = await supabaseAdmin
      .from('Selection')
      .update({
        paid: true,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, paid: true })
  } catch (error) {
    console.error('Error marking selection as paid:', error)
    return NextResponse.json(
      { error: 'Fehler beim Markieren als bezahlt' },
      { status: 500 }
    )
  }
}

/**
 * Unconfirm a payment (only sets paid=false)
 * Status remains SELECTING - this only removes the payer's confirmation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Validate UUID
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Update ONLY the paid flag (status remains SELECTING)
    const { error: updateError } = await supabaseAdmin
      .from('Selection')
      .update({
        paid: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, paid: false })
  } catch (error) {
    console.error('Error unmarking selection as paid:', error)
    return NextResponse.json(
      { error: 'Fehler beim Zurücksetzen' },
      { status: 500 }
    )
  }
}
