import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, itemQuantities } = body

    if (!billId || !itemQuantities) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the bill to retrieve the payer name
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('payerName')
      .eq('id', billId)
      .single()

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      )
    }

    // Check if owner selection already exists
    const { data: existingSelection } = await supabaseAdmin
      .from('Selection')
      .select('*')
      .eq('billId', billId)
      .eq('friendName', bill.payerName)
      .single()

    if (existingSelection) {
      // Update existing owner selection
      const { data, error } = await supabaseAdmin
        .from('Selection')
        .update({
          itemQuantities,
          paid: true,
          tipAmount: 0,
        })
        .eq('id', existingSelection.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ selection: data })
    } else {
      // Create new owner selection
      const { data, error } = await supabaseAdmin
        .from('Selection')
        .insert({
          billId,
          friendName: bill.payerName,
          itemQuantities,
          tipAmount: 0,
          paid: true,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ selection: data })
    }
  } catch (error) {
    console.error('Owner selection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
