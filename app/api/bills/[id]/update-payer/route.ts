import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { payerName } = body

    // Validation
    if (!payerName) {
      return NextResponse.json(
        { error: 'Bitte gib deinen Namen ein' },
        { status: 400 }
      )
    }

    // Sanitize and validate payerName
    const sanitizedName = sanitizeInput(payerName, 100)
    if (sanitizedName.length === 0 || sanitizedName.length > 100) {
      return NextResponse.json(
        { error: 'Name muss zwischen 1 und 100 Zeichen lang sein' },
        { status: 400 }
      )
    }

    // Update bill
    const { data: bill, error } = await supabaseAdmin
      .from('Bill')
      .update({ payerName: sanitizedName })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      payerName: bill.payerName,
    })
  } catch (error) {
    console.error('Error updating payer name:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Namens' },
      { status: 500 }
    )
  }
}
