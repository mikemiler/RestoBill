import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('BillItem')
      .select('*')
      .eq('billId', params.id)
      .order('name')

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json({ error: 'Fehler beim Laden der Items' }, { status: 500 })
    }

    return NextResponse.json(items || [])
  } catch (error) {
    console.error('Error in items API:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
