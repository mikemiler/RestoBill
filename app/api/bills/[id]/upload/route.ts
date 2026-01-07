import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadBillImage } from '@/lib/supabase'
import { analyzeBillImage } from '@/lib/claude'
import { validateImageFile } from '@/lib/utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const billId = params.id

    // Validate billId format (UUID)
    if (!/^[a-f0-9-]{36}$/i.test(billId)) {
      return NextResponse.json({ error: 'Ungültige Bill ID' }, { status: 400 })
    }

    // Get bill from database
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        items: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Prevent reupload if bill already has items (processed)
    if (bill.items.length > 0) {
      return NextResponse.json(
        { error: 'Rechnung wurde bereits verarbeitet' },
        { status: 409 }
      )
    }

    // Get image from form data
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: 'Kein Bild hochgeladen' }, { status: 400 })
    }

    // Validate file type and size
    const validation = validateImageFile(image, 10)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Upload image to Supabase Storage
    const imageUrl = await uploadBillImage(billId, image)

    // Analyze image with Claude Vision API
    const analysis = await analyzeBillImage(imageUrl)

    // Validate analysis result
    if (!analysis.items || analysis.items.length === 0) {
      return NextResponse.json(
        { error: 'Keine Positionen auf der Rechnung erkannt' },
        { status: 400 }
      )
    }

    // Use transaction for atomic operations
    await prisma.$transaction(async (tx) => {
      // Update bill with image URL and restaurant info
      await tx.bill.update({
        where: { id: billId },
        data: {
          imageUrl,
          restaurantName: analysis.restaurantName,
          totalAmount: analysis.totalAmount,
        },
      })

      // Create bill items from analysis
      await tx.billItem.createMany({
        data: analysis.items.map((item) => ({
          billId,
          name: item.name,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.pricePerUnit * item.quantity,
        })),
      })
    })

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
