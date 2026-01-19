import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { billId, sessionId, friendName, rating, feedbackText } = body

    // Validation
    if (!billId || typeof billId !== 'string') {
      return NextResponse.json(
        { error: 'billId ist erforderlich' },
        { status: 400 }
      )
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId ist erforderlich' },
        { status: 400 }
      )
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 3) {
      return NextResponse.json(
        { error: 'rating muss 1, 2 oder 3 sein' },
        { status: 400 }
      )
    }

    // Verify bill exists
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: { id: true }
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    // Check if user already gave feedback
    const existingFeedback = await prisma.restaurantFeedback.findFirst({
      where: {
        billId,
        sessionId
      }
    })

    if (existingFeedback) {
      // Update existing feedback
      const updated = await prisma.restaurantFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          rating,
          feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
          friendName: friendName ? sanitizeInput(friendName) : null
        }
      })

      return NextResponse.json({
        success: true,
        feedback: updated
      })
    }

    // Create new feedback
    const feedback = await prisma.restaurantFeedback.create({
      data: {
        billId,
        sessionId,
        rating,
        feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
        friendName: friendName ? sanitizeInput(friendName) : null
      }
    })

    return NextResponse.json({
      success: true,
      feedback
    })
  } catch (error) {
    console.error('Fehler beim Speichern des Feedbacks:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern des Feedbacks' },
      { status: 500 }
    )
  }
}
