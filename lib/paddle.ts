/**
 * Paddle Payment Integration
 *
 * Handles payment processing via Paddle (Merchant of Record)
 * - Paddle handles ALL tax compliance (EU-VAT, US Sales Tax, etc.)
 * - Supports custom amounts (user-defined support payments)
 * - Source tracking to differentiate WerHatteWas vs WebChangeDetector
 */

import { Paddle, type EventName } from '@paddle/paddle-node-sdk'

// Initialize Paddle client (singleton)
const paddle = new Paddle(process.env.PADDLE_API_KEY || '')

/**
 * Source identifier for tracking payments
 */
export type PaymentSource = 'werhattewas' | 'webchangedetector'

/**
 * Create a support transaction with custom amount
 *
 * @param amount - Amount in EUR (e.g., 10.50)
 * @param source - Source identifier (werhattewas or webchangedetector)
 * @returns Transaction object with ID for Paddle Checkout
 */
export async function createSupportTransaction(
  amount: number,
  source: PaymentSource = 'werhattewas'
) {
  // Validate amount (min €1, max €500)
  if (amount < 1) {
    throw new Error('Minimum amount is €1')
  }
  if (amount > 500) {
    throw new Error('Maximum amount is €500')
  }

  // Get product ID from environment
  const productId = process.env.PADDLE_WERHATTEWAS_PRODUCT_ID
  if (!productId) {
    throw new Error('PADDLE_WERHATTEWAS_PRODUCT_ID not configured')
  }

  try {
    // Create transaction with inline custom price
    const transaction = await paddle.transactions.create({
      items: [
        {
          quantity: 1,
          price: {
            description: `WerHatteWas Developer Support - €${amount}`,
            name: 'WerHatteWas Support',
            product_id: productId,
            tax_mode: 'account_setting', // Use Paddle's tax settings
            unit_price: {
              amount: (amount * 100).toString(), // Convert to cents (€10 → "1000")
              currency_code: 'EUR',
            },
            // No billing_cycle = one-time payment
          },
        },
      ],
      // Custom data for tracking (visible in Paddle Dashboard & webhooks)
      custom_data: {
        source, // 'restobill' or 'webchangedetector'
        app: 'werhattewas',
        version: '1.0',
        timestamp: new Date().toISOString(),
      },
    })

    return transaction
  } catch (error) {
    console.error('Paddle transaction creation failed:', error)
    throw new Error('Failed to create payment transaction')
  }
}

/**
 * Verify webhook signature (for webhook handler)
 *
 * @param payload - Raw webhook payload
 * @param signature - Paddle-Signature header
 * @returns Whether signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('PADDLE_WEBHOOK_SECRET not configured')
    return false
  }

  try {
    // Paddle SDK handles signature verification
    return paddle.webhooks.unmarshal(payload, webhookSecret, signature) !== null
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

/**
 * Parse webhook event
 *
 * @param payload - Raw webhook payload
 * @param signature - Paddle-Signature header
 * @returns Parsed event or null if invalid
 */
export function parseWebhookEvent(payload: string, signature: string) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('PADDLE_WEBHOOK_SECRET not configured')
  }

  try {
    return paddle.webhooks.unmarshal(payload, webhookSecret, signature)
  } catch (error) {
    console.error('Webhook parsing failed:', error)
    return null
  }
}

/**
 * Format amount for display (EUR)
 */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
