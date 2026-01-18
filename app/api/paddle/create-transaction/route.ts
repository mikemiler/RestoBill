/**
 * API Route: Create Paddle Transaction
 *
 * POST /api/paddle/create-transaction
 *
 * Creates a Paddle transaction for developer support payments
 * with custom amount and source tracking
 *
 * Uses Paddle's "Inline Custom Price" feature - no pre-defined prices needed!
 * The price is created dynamically for each transaction based on user input.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupportTransaction, type PaymentSource } from '@/lib/paddle'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, source } = body

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Amount is required and must be a number' },
        { status: 400 }
      )
    }

    if (amount < 1) {
      return NextResponse.json(
        { error: 'Mindestbetrag ist €1' },
        { status: 400 }
      )
    }

    if (amount > 500) {
      return NextResponse.json(
        { error: 'Maximalbetrag ist €500' },
        { status: 400 }
      )
    }

    // Validate source (optional, defaults to 'werhattewas')
    const paymentSource: PaymentSource = source === 'webchangedetector'
      ? 'webchangedetector'
      : 'werhattewas'

    // Create transaction
    const transaction = await createSupportTransaction(amount, paymentSource)

    // Log transaction creation for debugging
    console.log('✅ Paddle transaction created:', {
      transactionId: transaction.id,
      amount: `€${amount}`,
      source: paymentSource,
      status: transaction.status,
    })

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      amount,
      source: paymentSource,
    })
  } catch (error) {
    console.error('❌ Paddle transaction creation failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Erstellen der Zahlung',
      },
      { status: 500 }
    )
  }
}
