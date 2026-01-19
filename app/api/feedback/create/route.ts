import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { billId, sessionId, friendName, rating, feedbackText } = body

    console.log('📝 Feedback API called with:', { billId, sessionId, rating, hasText: !!feedbackText })

    // Validation
    if (!billId || typeof billId !== 'string') {
      console.log('❌ Validation failed: billId missing or invalid')
      return NextResponse.json(
        { error: 'billId ist erforderlich' },
        { status: 400 }
      )
    }

    if (!sessionId || typeof sessionId !== 'string') {
      console.log('❌ Validation failed: sessionId missing or invalid')
      return NextResponse.json(
        { error: 'sessionId ist erforderlich' },
        { status: 400 }
      )
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 3) {
      console.log('❌ Validation failed: rating invalid', { rating, type: typeof rating })
      return NextResponse.json(
        { error: 'rating muss 1, 2 oder 3 sein' },
        { status: 400 }
      )
    }

    // Verify bill exists
    console.log('🔍 Checking if bill exists...')
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: { id: true }
    })

    if (!bill) {
      console.log('❌ Bill not found:', billId)
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    console.log('✅ Bill exists')

    // Check if user already gave feedback
    console.log('🔍 Checking for existing feedback...')
    const existingFeedback = await prisma.restaurantFeedback.findFirst({
      where: {
        billId,
        sessionId
      }
    })

    if (existingFeedback) {
      console.log('📝 Updating existing feedback:', existingFeedback.id)
      // Update existing feedback
      const updated = await prisma.restaurantFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          rating,
          feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
          friendName: friendName ? sanitizeInput(friendName) : null
        }
      })

      console.log('✅ Feedback updated successfully')
      return NextResponse.json({
        success: true,
        feedback: updated
      })
    }

    // Create new feedback
    console.log('➕ Creating new feedback...')
    const feedback = await prisma.restaurantFeedback.create({
      data: {
        billId,
        sessionId,
        rating,
        feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
        friendName: friendName ? sanitizeInput(friendName) : null
      }
    })

    console.log('✅ Feedback created successfully:', feedback.id)
    return NextResponse.json({
      success: true,
      feedback
    })
  } catch (error) {
    console.error('❌ Error in feedback API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: `Fehler beim Speichern des Feedbacks: ${errorMessage}` },
      { status: 500 }
    )
  }
}
