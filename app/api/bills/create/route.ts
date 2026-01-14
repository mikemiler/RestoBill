import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { payerName, paypalHandle } = body

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

    // Validate paypalHandle format (alphanumeric, underscore, hyphen) - optional field
    let sanitizedHandle: string | null = null
    if (paypalHandle && paypalHandle.trim()) {
      sanitizedHandle = paypalHandle.trim()
      if (!/^[A-Za-z0-9_-]+$/.test(sanitizedHandle) || sanitizedHandle.length > 50) {
        return NextResponse.json(
          { error: 'Ungültiger PayPal Username' },
          { status: 400 }
        )
      }
    }

    // Create bill in database using Supabase
    const { data: bill, error } = await supabaseAdmin
      .from('Bill')
      .insert({
        id: randomUUID(),
        payerName: sanitizedName,
        paypalHandle: sanitizedHandle,
        imageUrl: '',
        shareToken: randomUUID(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      billId: bill.id,
      shareToken: bill.shareToken,
    })
  } catch (error) {
    console.error('Error creating bill:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Rechnung' },
      { status: 500 }
    )
  }
}
