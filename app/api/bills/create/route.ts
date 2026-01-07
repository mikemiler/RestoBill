import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { payerName, paypalHandle } = body

    // Validation
    if (!payerName || !paypalHandle) {
      return NextResponse.json(
        { error: 'Bitte fülle alle Felder aus' },
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

    // Validate paypalHandle format (alphanumeric, underscore, hyphen)
    const sanitizedHandle = paypalHandle.trim()
    if (!/^[A-Za-z0-9_-]+$/.test(sanitizedHandle) || sanitizedHandle.length > 50) {
      return NextResponse.json(
        { error: 'Ungültiger PayPal Username' },
        { status: 400 }
      )
    }

    // Create bill in database
    const bill = await prisma.bill.create({
      data: {
        payerName: sanitizedName,
        paypalHandle: sanitizedHandle,
        imageUrl: '', // Will be set after upload
      },
    })

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
