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

    // Get all active (not expired) selections for this bill
    const { data: activeSelections, error } = await supabaseAdmin
      .from('ActiveSelection')
      .select('*')
      .eq('billId', id)
      .gte('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(activeSelections || [])
  } catch (error) {
    console.error('Error fetching live selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Live-Auswahlen' },
      { status: 500 }
    )
  }
}
