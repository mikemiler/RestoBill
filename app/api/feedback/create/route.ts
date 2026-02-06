import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput, getBaseUrl } from '@/lib/utils'
import { notifyFeedbackReceived } from '@/lib/slack'
import { randomUUID } from 'crypto'

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
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('id, restaurantName')
      .eq('id', billId)
      .single()

    if (billError || !bill) {
      console.log('❌ Bill not found:', billId, billError)
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    console.log('✅ Bill exists')

    // Check if user already gave feedback
    console.log('🔍 Checking for existing feedback...')
    const { data: existingFeedback, error: existingError } = await supabaseAdmin
      .from('RestaurantFeedback')
      .select('*')
      .eq('billId', billId)
      .eq('sessionId', sessionId)
      .maybeSingle() // Use maybeSingle instead of single - returns null if not found

    if (existingFeedback) {
      console.log('📝 Updating existing feedback:', existingFeedback.id)
      // Update existing feedback
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('RestaurantFeedback')
        .update({
          rating,
          feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
          friendName: friendName ? sanitizeInput(friendName) : null
        })
        .eq('id', existingFeedback.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Update error:', updateError)
        throw updateError
      }

      console.log('✅ Feedback updated successfully')

      // Slack notification (fire-and-forget)
      notifyFeedbackReceived({
        billId,
        restaurantName: bill.restaurantName || null,
        rating,
        feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
        friendName: friendName ? sanitizeInput(friendName) : null,
      }).catch((err) => console.error('[Slack] Notification error:', err))

      return NextResponse.json({
        success: true,
        feedback: updated
      })
    }

    // Create new feedback
    console.log('➕ Creating new feedback...')
    const { data: feedback, error: createError } = await supabaseAdmin
      .from('RestaurantFeedback')
      .insert({
        id: randomUUID(), // CRITICAL: Supabase doesn't auto-generate UUIDs, must be set manually
        billId,
        sessionId,
        rating,
        feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
        friendName: friendName ? sanitizeInput(friendName) : null
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Create error:', createError)
      throw createError
    }

    console.log('✅ Feedback created successfully:', feedback.id)

    // Slack notification (fire-and-forget)
    notifyFeedbackReceived({
      billId,
      restaurantName: bill.restaurantName || null,
      rating,
      feedbackText: feedbackText ? sanitizeInput(feedbackText) : null,
      friendName: friendName ? sanitizeInput(friendName) : null,
    }).catch((err) => console.error('[Slack] Notification error:', err))

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
