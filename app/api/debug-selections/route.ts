import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to show ALL selections for a bill (PAID + SELECTING)
 * Usage: GET /api/debug-selections?billId=xxx
 *    OR: GET /api/debug-selections?shareToken=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let billId = searchParams.get('billId')
    const shareToken = searchParams.get('shareToken')

    // If shareToken provided, look up billId
    if (shareToken && !billId) {
      const { data: bill, error: billError } = await supabaseAdmin
        .from('Bill')
        .select('id')
        .eq('shareToken', shareToken)
        .single()

      if (billError || !bill) {
        return NextResponse.json({ error: 'Bill not found with shareToken' }, { status: 404 })
      }

      billId = bill.id
    }

    if (!billId) {
      return NextResponse.json({ error: 'billId or shareToken required' }, { status: 400 })
    }

    // Get ALL selections (both PAID and SELECTING) for debugging
    const { data: allSelections, error } = await supabaseAdmin
      .from('Selection')
      .select('*')
      .eq('billId', billId)
      .order('createdAt', { ascending: false })

    if (error) {
      throw error
    }

    // Group by status
    const paid = allSelections?.filter(s => s.status === 'PAID') || []
    const selecting = allSelections?.filter(s => s.status === 'SELECTING') || []

    // Get bill items for reference
    const { data: items } = await supabaseAdmin
      .from('BillItem')
      .select('*')
      .eq('billId', billId)

    return NextResponse.json({
      billId,
      timestamp: new Date().toISOString(),
      summary: {
        totalSelections: allSelections?.length || 0,
        paidCount: paid.length,
        selectingCount: selecting.length,
      },
      items: items || [],
      selections: {
        paid: paid.map(s => ({
          id: s.id,
          sessionId: s.sessionId,
          friendName: s.friendName,
          status: s.status,
          itemQuantities: s.itemQuantities,
          tipAmount: s.tipAmount,
          paymentMethod: s.paymentMethod,
          paid: s.paid,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        selecting: selecting.map(s => ({
          id: s.id,
          sessionId: s.sessionId,
          friendName: s.friendName,
          status: s.status,
          itemQuantities: s.itemQuantities,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        }))
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}
