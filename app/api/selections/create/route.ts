import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePayPalUrl } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, shareToken, friendName, itemQuantities, tipAmount } = body

    // Validation
    if (!billId || !shareToken || !friendName || !itemQuantities) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      )
    }

    // Verify share token
    const bill = await prisma.bill.findFirst({
      where: {
        id: billId,
        shareToken: shareToken,
      },
      include: {
        items: true,
      },
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    // Calculate total amount
    let totalAmount = 0
    const selectedItemIds: string[] = []

    for (const [itemId, quantity] of Object.entries(itemQuantities)) {
      const item = bill.items.find((i) => i.id === itemId)
      if (item && typeof quantity === 'number' && quantity > 0) {
        totalAmount += item.pricePerUnit * item.quantity * quantity
        selectedItemIds.push(itemId)
      }
    }

    // Add tip
    const tip = typeof tipAmount === 'number' ? tipAmount : 0
    totalAmount += tip

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Gesamtbetrag muss größer als 0 sein' },
        { status: 400 }
      )
    }

    // Create selection in database
    const selection = await prisma.selection.create({
      data: {
        billId,
        friendName: friendName.trim(),
        items: {
          connect: selectedItemIds.map((id) => ({ id })),
        },
        itemQuantities: itemQuantities,
        tipAmount: tip,
      },
    })

    // Generate PayPal.me URL
    const paypalUrl = generatePayPalUrl(bill.paypalHandle, totalAmount)

    return NextResponse.json({
      selectionId: selection.id,
      totalAmount,
      paypalUrl,
    })
  } catch (error) {
    console.error('Error creating selection:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Auswahl' },
      { status: 500 }
    )
  }
}
