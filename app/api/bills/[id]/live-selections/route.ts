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

    // Return with no-cache headers to prevent browser caching
    return NextResponse.json(liveSelections || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching live selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Live-Auswahlen' },
      { status: 500 }
    )
  }
}
