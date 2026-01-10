import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
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

    // Get all selections for this bill
    const { data: selections, error } = await supabaseAdmin
      .from('Selection')
      .select('id, itemQuantities')
      .eq('billId', id)

    if (error) {
      throw error
    }

    return NextResponse.json(selections || [])
  } catch (error) {
    console.error('Error fetching selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Selections' },
      { status: 500 }
    )
  }
}
