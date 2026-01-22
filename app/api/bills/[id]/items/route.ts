import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering - disable Next.js caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('BillItem')
      .select('*')
      .eq('billId', params.id)
      .order('position')

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json({ error: 'Fehler beim Laden der Items' }, { status: 500 })
    }

    // Return with no-cache headers to prevent browser caching
    return NextResponse.json(items || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error in items API:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
