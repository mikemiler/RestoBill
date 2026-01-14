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

    // Get all Selections with status=SELECTING (live tracking) for this bill
    const { data: liveSelections, error } = await supabaseAdmin
      .from('Selection')
      .select('*')
      .eq('billId', id)
      .eq('status', 'SELECTING')
      .gte('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(liveSelections || [])
  } catch (error) {
    console.error('Error fetching live selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Live-Auswahlen' },
      { status: 500 }
    )
  }
}
