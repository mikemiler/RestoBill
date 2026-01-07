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
                type: 'url',
                url: imageUrl,
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
      const match = text.match(/```(?:json)?\n?(.*?)\n?```/s)
      if (match) {
        jsonText = match[1]
      }
    }

    const result = JSON.parse(jsonText) as BillAnalysisResult

    // Validate and calculate totalPrice for each item
    result.items = result.items.map((item) => ({
      ...item,
      pricePerUnit: Number(item.pricePerUnit),
      quantity: Number(item.quantity),
    }))

    return result
  } catch (error) {
    console.error('Error analyzing bill image:', error)
    throw new Error('Fehler beim Analysieren der Rechnung')
  }
}
