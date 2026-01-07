import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Validate paypalHandle format (alphanumeric, underscore, hyphen)
    if (!/^[A-Za-z0-9_-]+$/.test(paypalHandle)) {
      return NextResponse.json(
        { error: 'Ungültiger PayPal Username' },
        { status: 400 }
      )
    }

    // Create bill in database
    const bill = await prisma.bill.create({
      data: {
        payerName,
        paypalHandle,
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
