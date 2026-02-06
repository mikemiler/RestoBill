import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface BillItemExtracted {
  name: string
  quantity: number
  pricePerUnit: number
}

export interface BillAnalysisResult {
  items: BillItemExtracted[]
  restaurantName?: string
  totalAmount?: number
  restaurantAddress?: string // Full address from the receipt
}

/**
 * Analyze restaurant bill image using Claude Vision API
 * @param imageUrl - Public URL of the bill image
 * @returns Extracted bill items and metadata
 */
export async function analyzeBillImage(
  imageUrl: string
): Promise<BillAnalysisResult> {
  const prompt = `Analyze this restaurant receipt and extract ALL line items.

IMPORTANT:
- Receipts can be in any language. Extract item names in the original language of the receipt.
- Extract EVERY individual item on the receipt
- If an item appears multiple times, indicate the quantity
- Calculate the price per unit (pricePerUnit = totalPrice / quantity)
- Ignore totals, subtotals, VAT, service charges
- Extract only the actual food and drink items
- Also extract the FULL ADDRESS of the restaurant (if visible on the receipt)

Return the response as JSON in the following format:
{
  "items": [
    {
      "name": "Pizza Margherita",
      "quantity": 2,
      "pricePerUnit": 12.50
    }
  ],
  "restaurantName": "Restaurant Name (optional)",
  "totalAmount": 45.00 (optional, total amount if recognizable),
  "restaurantAddress": "Full address including street, postal code, city (optional, ONLY if visible on receipt)"
}

Respond ONLY with the JSON object, without any additional text.`

  try {
    // Validate URL to prevent SSRF attacks
    const url = new URL(imageUrl)
    const allowedHosts = ['supabase.co']

    if (!allowedHosts.some(host => url.hostname.endsWith(host))) {
      throw new Error('Invalid image URL - only Supabase URLs allowed')
    }

    // Download image with timeout and size limit
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const imageResponse = await fetch(imageUrl, {
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!imageResponse.ok) {
      throw new Error('Failed to download image')
    }

    // Check content length
    const contentLength = imageResponse.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      throw new Error('Image too large (max 10MB)')
    }

    const imageBuffer = await imageResponse.arrayBuffer()

    // Resize image to reduce API costs and improve speed
    // Max 2000px on longest side, 85% quality
    const resizedBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true, // Don't upscale smaller images
      })
      .jpeg({ quality: 85 }) // Convert to JPEG for best compatibility
      .toBuffer()

    const base64Image = resizedBuffer.toString('base64')

    // Always use JPEG after sharp processing
    const mediaType = 'image/jpeg'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    // Extract JSON from response
    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse JSON response
    const text = content.text.trim()

    // Try to extract JSON if wrapped in markdown code blocks
    let jsonText = text
    if (text.startsWith('```')) {
      const match = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      if (match) {
        jsonText = match[1]
      }
    }

    const result = JSON.parse(jsonText) as BillAnalysisResult

    // Validate result structure
    if (!result.items || !Array.isArray(result.items)) {
      throw new Error('Invalid analysis result structure')
    }

    // Validate and calculate totalPrice for each item
    result.items = result.items.map((item) => {
      const pricePerUnit = Number(item.pricePerUnit)
      const quantity = Number(item.quantity)

      if (isNaN(pricePerUnit) || isNaN(quantity) || pricePerUnit <= 0 || quantity <= 0) {
        throw new Error(`Invalid price or quantity for item: ${item.name}`)
      }

      if (pricePerUnit > 10000 || quantity > 100) {
        throw new Error(`Unrealistic values for item: ${item.name}`)
      }

      return {
        ...item,
        pricePerUnit,
        quantity,
      }
    })

    return result
  } catch (error) {
    console.error('Error analyzing bill image:', error)
    throw new Error('Error analyzing bill image')
  }
}
