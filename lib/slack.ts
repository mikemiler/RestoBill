/**
 * Slack Webhook Integration
 * Sends rich Block Kit notifications to a configured Slack channel.
 * Non-blocking: errors are logged but never thrown to callers.
 */

import { formatEUR } from '@/lib/utils'

// ---------- Types ----------

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{
    type: string
    text?: string | { type: string; text: string }
    url?: string
    action_id?: string
  }>
  fields?: Array<{ type: string; text: string }>
}

interface SlackMessage {
  text: string // Fallback plain text (for push notifications)
  blocks: SlackBlock[]
}

// ---------- Core send function ----------

/**
 * Send a message to the configured Slack webhook.
 * Fire-and-forget: logs errors, never throws.
 */
async function sendSlackMessage(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Slack] Webhook error:', response.status, errorText)
    } else {
      console.log('[Slack] Notification sent successfully')
    }
  } catch (error) {
    console.error('[Slack] Failed to send notification:', error)
  }
}

// ---------- Public notification functions ----------

/**
 * Notify when a bill has been analyzed.
 * Called from /api/bills/[id]/upload after successful analysis.
 */
export async function notifyBillAnalyzed(params: {
  billId: string
  payerName: string
  restaurantName: string | null
  restaurantAddress: string | null
  totalAmount: number | null
  itemCount: number
  googleMapsUrl: string | null
  requestUrl: string
}): Promise<void> {
  const {
    billId,
    payerName,
    restaurantName,
    restaurantAddress,
    totalAmount,
    itemCount,
    googleMapsUrl,
    requestUrl,
  } = params

  const baseUrl = new URL(requestUrl).origin
  const restaurantDisplay = restaurantName || 'Unbekanntes Restaurant'
  const totalDisplay = totalAmount ? formatEUR(totalAmount) : 'N/A'
  const statusPageUrl = `${baseUrl}/bills/${billId}/status`
  const fallback = `New bill: ${restaurantDisplay} (${totalDisplay}, ${itemCount} items) by ${payerName}`

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'New Bill Analyzed', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Restaurant:*\n${restaurantDisplay}` },
        { type: 'mrkdwn', text: `*Total:*\n${totalDisplay}` },
        { type: 'mrkdwn', text: `*Items:*\n${itemCount}` },
        { type: 'mrkdwn', text: `*Payer:*\n${payerName}` },
      ],
    },
  ]

  if (restaurantAddress) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Address:* ${restaurantAddress}` },
    })
  }

  const actionElements: NonNullable<SlackBlock['elements']> = [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'Open Status Page' },
      url: statusPageUrl,
      action_id: 'open_status_page',
    },
  ]

  if (googleMapsUrl) {
    actionElements.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View on Google Maps' },
      url: googleMapsUrl,
      action_id: 'open_google_maps',
    })
  }

  blocks.push({ type: 'actions', elements: actionElements })

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Bill ID: \`${billId.slice(0, 8)}...\`` },
    ],
  })

  await sendSlackMessage({ text: fallback, blocks })
}

/**
 * Notify when restaurant feedback is submitted.
 * Called from /api/feedback/create after successful save.
 */
export async function notifyFeedbackReceived(params: {
  billId: string
  restaurantName: string | null
  rating: number
  feedbackText: string | null
  friendName: string | null
  requestUrl: string
}): Promise<void> {
  const { billId, restaurantName, rating, feedbackText, friendName, requestUrl } = params

  const baseUrl = new URL(requestUrl).origin
  const ratingLabel: Record<number, string> = { 1: 'Schlecht', 2: 'Mittel', 3: 'Top' }
  const ratingIcon: Record<number, string> = {
    1: ':disappointed:',
    2: ':neutral_face:',
    3: ':blush:',
  }

  const restaurantDisplay = restaurantName || 'Unbekanntes Restaurant'
  const guestDisplay = friendName || 'Anonymous'
  const label = ratingLabel[rating] || 'Unknown'
  const icon = ratingIcon[rating] || ':question:'
  const statusPageUrl = `${baseUrl}/bills/${billId}/status`
  const fallback = `Feedback for ${restaurantDisplay}: ${label} by ${guestDisplay}`

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Restaurant Feedback Received', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Restaurant:*\n${restaurantDisplay}` },
        { type: 'mrkdwn', text: `*Rating:*\n${icon} ${label}` },
        { type: 'mrkdwn', text: `*Guest:*\n${guestDisplay}` },
      ],
    },
  ]

  if (feedbackText && rating < 3) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Feedback:*\n> ${feedbackText}` },
    })
  }

  if (rating === 3) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':star: Guest was redirected to leave a Google review.' },
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Open Status Page' },
        url: statusPageUrl,
        action_id: 'open_status_page',
      },
    ],
  })

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Bill ID: \`${billId.slice(0, 8)}...\`` },
    ],
  })

  await sendSlackMessage({ text: fallback, blocks })
}
