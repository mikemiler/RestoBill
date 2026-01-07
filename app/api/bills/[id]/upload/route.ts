import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadBillImage } from '@/lib/supabase'
import { analyzeBillImage } from '@/lib/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const billId = params.id

    // Get bill from database
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Get image from form data
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: 'Kein Bild hochgeladen' }, { status: 400 })
    }

    // Upload image to Supabase Storage
    const imageUrl = await uploadBillImage(billId, image)

    // Analyze image with Claude Vision API
    const analysis = await analyzeBillImage(imageUrl)

    // Update bill with image URL and restaurant info
    await prisma.bill.update({
      where: { id: billId },
      data: {
        imageUrl,
        restaurantName: analysis.restaurantName,
        totalAmount: analysis.totalAmount,
      },
    })

    // Create bill items from analysis
    await Promise.all(
      analysis.items.map((item) =>
        prisma.billItem.create({
          data: {
            billId,
            name: item.name,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.pricePerUnit * item.quantity,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      itemsCount: analysis.items.length,
      imageUrl,
    })
  } catch (error) {
    console.error('Error uploading and analyzing bill:', error)
    return NextResponse.json(
      { error: 'Fehler beim Verarbeiten der Rechnung' },
      { status: 500 }
    )
  }
}
