import Anthropic from '@anthropic-ai/sdk'

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
}

/**
 * Analyze restaurant bill image using Claude Vision API
 * @param imageUrl - Public URL of the bill image
 * @returns Extracted bill items and metadata
 */
export async function analyzeBillImage(
  imageUrl: string
): Promise<BillAnalysisResult> {
  const prompt = `Analysiere diese Restaurant-Rechnung und extrahiere ALLE Positionen.

WICHTIG:
- Extrahiere JEDE einzelne Position auf der Rechnung
- Wenn eine Position mehrfach vorkommt, gib die Anzahl an
- Berechne den Preis pro Stück (pricePerUnit = totalPrice / quantity)
- Ignoriere Summen, Zwischensummen, MwSt, Service Charges
- Extrahiere nur die eigentlichen Speisen und Getränke

Gib die Antwort als JSON zurück im folgenden Format:
{
  "items": [
    {
      "name": "Pizza Margherita",
      "quantity": 2,
      "pricePerUnit": 12.50
    }
  ],
  "restaurantName": "Restaurant Name (optional)",
  "totalAmount": 45.00 (optional, Gesamtsumme falls erkennbar)
}

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`

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
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // Determine media type from URL or response
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const mediaType = contentType.includes('png')
      ? 'image/png'
      : contentType.includes('heic')
      ? 'image/heic'
      : 'image/jpeg'

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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
    throw new Error('Fehler beim Analysieren der Rechnung')
  }
}
