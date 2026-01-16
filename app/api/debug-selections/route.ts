import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const billId = searchParams.get('billId')

    if (!billId) {
      return NextResponse.json(
        { error: 'billId query parameter required' },
        { status: 400 }
      )
    }

    // Get all selections for this bill (both SELECTING and PAID)
    const { data: allSelections, error: selectionsError } = await supabaseAdmin
      .from('Selection')
      .select('*')
      .eq('billId', billId)
      .order('createdAt', { ascending: false })

    if (selectionsError) {
      throw selectionsError
    }

    // Separate by status
    const selectingSelections = allSelections?.filter(s => s.status === 'SELECTING') || []
    const paidSelections = allSelections?.filter(s => s.status === 'PAID') || []

    // Get bill items for reference
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('BillItem')
      .select('id, name, quantity, pricePerUnit')
      .eq('billId', billId)

    if (itemsError) {
      throw itemsError
    }

    // Calculate totals
    const calculateTotal = (selection: any): number => {
      let itemsTotal = 0
      if (selection.itemQuantities) {
        Object.entries(selection.itemQuantities as Record<string, number>).forEach(([itemId, quantity]) => {
          const item = items?.find(i => i.id === itemId)
          if (item) {
            itemsTotal += item.pricePerUnit * quantity
          }
        })
      }
      return itemsTotal + (selection.tipAmount || 0)
    }

    const selectingTotal = selectingSelections.reduce((sum, s) => sum + calculateTotal(s), 0)
    const paidTotal = paidSelections.reduce((sum, s) => sum + calculateTotal(s), 0)
    const totalTips = allSelections?.reduce((sum, s) => sum + (s.tipAmount || 0), 0) || 0

    return NextResponse.json({
      billId,
      timestamp: new Date().toISOString(),
      counts: {
        total: allSelections?.length || 0,
        selecting: selectingSelections.length,
        paid: paidSelections.length,
      },
      totals: {
        selecting: selectingTotal,
        paid: paidTotal,
        tips: totalTips,
      },
      selections: {
        selecting: selectingSelections.map(s => ({
          id: s.id,
          friendName: s.friendName,
          sessionId: s.sessionId,
          itemQuantities: s.itemQuantities,
          tipAmount: s.tipAmount,
          total: calculateTotal(s),
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
        paid: paidSelections.map(s => ({
          id: s.id,
          friendName: s.friendName,
          sessionId: s.sessionId,
          itemQuantities: s.itemQuantities,
          tipAmount: s.tipAmount,
          paymentMethod: s.paymentMethod,
          paid: s.paid,
          total: calculateTotal(s),
          createdAt: s.createdAt,
        })),
      },
      items: items?.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        pricePerUnit: i.pricePerUnit,
      })),
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
