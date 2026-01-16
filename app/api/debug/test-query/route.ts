import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * DEBUG ENDPOINT - Test exact same query as /api/bills/[id]/selections
 *
 * Usage: /api/debug/test-query?billId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const billId = searchParams.get('billId')

    if (!billId) {
      return NextResponse.json({ error: 'billId required' }, { status: 400 })
    }

    console.log('🧪 [TEST-QUERY] Testing exact same query as selections endpoint')
    console.log('[TEST-QUERY] billId:', billId)

    // EXACT SAME QUERY AS /api/bills/[id]/selections
    const { data: selections, error } = await supabaseAdmin
      .from('Selection')
      .select('id, billId, friendName, itemQuantities, tipAmount, paid, paymentMethod, createdAt, status')
      .eq('billId', billId)
      .order('createdAt', { ascending: false })

    console.log('[TEST-QUERY] Raw result:', {
      success: !error,
      count: selections?.length || 0,
      error: error?.message
    })

    if (error) {
      console.error('[TEST-QUERY] Query error:', error)
      return NextResponse.json({
        error: error.message,
        details: error
      }, { status: 500 })
    }

    // Sanitize selections: ensure itemQuantities is never null (convert to empty object)
    const sanitizedSelections = (selections || []).map(sel => ({
      ...sel,
      itemQuantities: sel.itemQuantities || {}
    }))

    console.log('[TEST-QUERY] Sanitized:', {
      count: sanitizedSelections.length,
      data: sanitizedSelections.map(s => ({
        id: s.id,
        friendName: s.friendName,
        status: s.status,
        paid: s.paid,
        paymentMethod: s.paymentMethod,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        tipAmount: s.tipAmount
      }))
    })

    // Return detailed response
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      billId,
      query: {
        table: 'Selection',
        select: 'id, billId, friendName, itemQuantities, tipAmount, paid, paymentMethod, createdAt, status',
        filter: `billId = ${billId}`,
        order: 'createdAt DESC'
      },
      result: {
        count: sanitizedSelections.length,
        selections: sanitizedSelections
      }
    })
  } catch (error: any) {
    console.error('❌ [TEST-QUERY] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
