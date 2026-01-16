import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('🔍 [API /selections] ===== REQUEST START =====')
    console.log('[API /selections] billId:', id)
    console.log('[API /selections] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('[API /selections] Database URL:', process.env.DATABASE_URL ? 'Set' : 'MISSING')

    // Validate UUID
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Ungültige ID Format' },
        { status: 400 }
      )
    }

    // Get all selections for this bill (both SELECTING and PAID status)
    // Returns all selections regardless of status or paid flag
    console.log('[API /selections] Querying Supabase...')
    const { data: selections, error } = await supabaseAdmin
      .from('Selection')
      .select('id, billId, friendName, itemQuantities, tipAmount, paid, paymentMethod, createdAt, status')
      .eq('billId', id)
      .order('createdAt', { ascending: false })

    console.log('[API /selections] Query result:', {
      success: !error,
      count: selections?.length || 0,
      error: error?.message
    })

    if (error) {
      console.error('[API /selections] Query error:', error)
      throw error
    }

    // Sanitize selections: ensure itemQuantities is never null (convert to empty object)
    const sanitizedSelections = (selections || []).map(sel => ({
      ...sel,
      itemQuantities: sel.itemQuantities || {}
    }))

    console.log('[API /selections] ✅ Selections fetched:', {
      billId: id,
      count: sanitizedSelections.length,
      withPaymentMethod: sanitizedSelections.filter(s => s.paymentMethod).length,
      withoutPaymentMethod: sanitizedSelections.filter(s => !s.paymentMethod).length,
      selections: sanitizedSelections.map(s => ({
        id: s.id,
        friendName: s.friendName,
        paymentMethod: s.paymentMethod,
        paid: s.paid,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        tipAmount: s.tipAmount
      }))
    })
    console.log('[API /selections] ===== REQUEST END =====')

    // Return with debug info in headers for troubleshooting
    const response = NextResponse.json(sanitizedSelections)
    response.headers.set('X-Debug-Count', String(sanitizedSelections.length))
    response.headers.set('X-Debug-BillId', id)
    return response
  } catch (error) {
    console.error('Error fetching selections:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Selections' },
      { status: 500 }
    )
  }
}
