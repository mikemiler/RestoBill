/**
 * API Route: Paddle Webhook Handler
 *
 * POST /api/paddle/webhook
 *
 * Handles Paddle webhook events for payment tracking
 * Logs payments with source tracking (WerHatteWas vs WebChangeDetector)
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookEvent } from '@/lib/paddle'

export async function POST(req: NextRequest) {
  try {
    // Get raw body and signature
    const payload = await req.text()
    const signature = req.headers.get('paddle-signature')

    if (!signature) {
      console.error('❌ Webhook: Missing Paddle-Signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    // Parse and verify webhook event
    const event = parseWebhookEvent(payload, signature)

    if (!event) {
      console.error('❌ Webhook: Invalid signature or payload')
      return NextResponse.json(
        { error: 'Invalid webhook' },
        { status: 400 }
      )
    }

    // Extract event data
    const eventType = event.eventType
    const eventData = event.data as any

    console.log('📥 Paddle Webhook received:', {
      eventType,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
    })

    // Handle different event types
    switch (eventType) {
      case 'transaction.completed': {
        // Payment successful!
        const transactionId = eventData.id
        const customData = eventData.customData || {}
        const source = customData.source || 'unknown'
        const amount = eventData.details?.totals?.total || '0'
        const currency = eventData.currencyCode || 'EUR'

        console.log('💰 Payment completed:', {
          transactionId,
          source, // 'werhattewas' or 'webchangedetector'
          amount: `${parseInt(amount) / 100} ${currency}`,
          customData,
        })

        // Here you could:
        // 1. Store in database for analytics
        // 2. Send notification email
        // 3. Update metrics dashboard
        // 4. Trigger Discord/Slack notification

        break
      }

      case 'transaction.paid': {
        // Payment received (after any delays)
        const transactionId = eventData.id
        const customData = eventData.customData || {}
        const source = customData.source || 'unknown'

        console.log('✅ Payment confirmed:', {
          transactionId,
          source,
        })

        break
      }

      case 'transaction.payment_failed': {
        // Payment failed
        const transactionId = eventData.id
        const customData = eventData.customData || {}
        const source = customData.source || 'unknown'

        console.log('❌ Payment failed:', {
          transactionId,
          source,
        })

        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${eventType}`)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook handler error:', error)

    // Still return 200 to prevent Paddle from retrying
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 200 }
    )
  }
}

// Disable body parsing to get raw payload
export const runtime = 'nodejs'
