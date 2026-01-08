import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
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

    // Update selection to mark as paid
    const { data: selection, error } = await supabaseAdmin
      .from('Selection')
      .update({
        paid: true,
        paidAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!selection) {
      return NextResponse.json(
        { error: 'Auswahl nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, selection })
  } catch (error) {
    console.error('Error marking selection as paid:', error)
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

    // Update selection to mark as unpaid
    const { data: selection, error } = await supabaseAdmin
      .from('Selection')
      .update({
        paid: false,
        paidAt: null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!selection) {
      return NextResponse.json(
        { error: 'Auswahl nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, selection })
  } catch (error) {
    console.error('Error marking selection as unpaid:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren' },
      { status: 500 }
    )
  }
}
