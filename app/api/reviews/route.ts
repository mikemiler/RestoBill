import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/utils'

// Valid sentiment values
const VALID_SENTIMENTS = ['SUPER', 'GUT', 'OKAY', 'MAESSIG', 'SCHLECHT'] as const
type ReviewSentiment = (typeof VALID_SENTIMENTS)[number]

// Positive sentiments for routing logic
const POSITIVE_SENTIMENTS: ReviewSentiment[] = ['SUPER', 'GUT']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, shareToken, selectionId, sentiment, googleReviewClicked, internalFeedback } =
      body

    // Validation
    if (!billId || !shareToken || !sentiment) {
      return NextResponse.json({ error: 'Fehlende Pflichtfelder' }, { status: 400 })
    }

    // Validate billId and shareToken format (UUID)
    if (!/^[a-f0-9-]{36}$/i.test(billId) || !/^[a-f0-9-]{36}$/i.test(shareToken)) {
      return NextResponse.json({ error: 'Ungültige ID Format' }, { status: 400 })
    }

    // Validate selectionId if provided
    if (selectionId && !/^[a-f0-9-]{36}$/i.test(selectionId)) {
      return NextResponse.json({ error: 'Ungültige Selection ID' }, { status: 400 })
    }

    // Validate sentiment
    if (!VALID_SENTIMENTS.includes(sentiment)) {
      return NextResponse.json(
        { error: 'Ungültiger Sentiment-Wert' },
        { status: 400 }
      )
    }

    // Verify share token
    const { data: bill, error: billError } = await supabaseAdmin
      .from('Bill')
      .select('id, shareToken, googlePlaceId')
      .eq('id', billId)
      .eq('shareToken', shareToken)
      .single()

    if (billError || !bill) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Determine if positive review
    const isPositive = POSITIVE_SENTIMENTS.includes(sentiment as ReviewSentiment)

    // Sanitize internal feedback if provided
    let sanitizedFeedback: string | null = null
    if (internalFeedback && typeof internalFeedback === 'string') {
      sanitizedFeedback = sanitizeInput(internalFeedback, 1000)
      if (sanitizedFeedback.length === 0) {
        sanitizedFeedback = null
      }
    }

    // Create review in database
    const reviewId = crypto.randomUUID()
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('Review')
      .insert({
        id: reviewId,
        billId: billId,
        selectionId: selectionId || null,
        sentiment: sentiment,
        isPositive: isPositive,
        googleReviewClicked: googleReviewClicked === true,
        internalFeedback: sanitizedFeedback,
      })
      .select()
      .single()

    if (reviewError) {
      console.error('Error creating review:', reviewError)
      throw reviewError
    }

    // If selectionId provided, mark selection as reviewed
    if (selectionId) {
      const { error: updateError } = await supabaseAdmin
        .from('Selection')
        .update({ reviewed: true })
        .eq('id', selectionId)

      if (updateError) {
        console.error('Error marking selection as reviewed:', updateError)
        // Don't fail the request, just log the error
      }
    }

    // Return success with review data
    return NextResponse.json({
      success: true,
      reviewId: review.id,
      isPositive: review.isPositive,
      sentiment: review.sentiment,
      googlePlaceId: bill.googlePlaceId || null,
    })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Bewertung' },
      { status: 500 }
    )
  }
}
