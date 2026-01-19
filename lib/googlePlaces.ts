/**
 * Google Places API Integration
 * Uses Text Search (New) API to find restaurants by name + address
 */

export interface PlaceSearchResult {
  placeId: string
  name: string
  formattedAddress: string
  googleMapsUrl: string
  reviewUrl: string
  photoUrl?: string // Optional: Restaurant-Foto
  rating?: number // Optional: Google Rating
  userRatingsTotal?: number // Optional: Anzahl Bewertungen
}

/**
 * Search for restaurant using Google Places Text Search API
 * @param restaurantName - Name vom Beleg (z.B. "Pizzeria Da Mario")
 * @param address - Adresse vom Beleg (z.B. "Hauptstraße 123, 80331 München")
 * @returns PlaceSearchResult or null if not found
 */
export async function searchRestaurant(
  restaurantName: string,
  address?: string
): Promise<PlaceSearchResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not configured')
    return null
  }

  try {
    // Build search query: "Restaurant Name, Address" (better matching)
    const query = address
      ? `${restaurantName}, ${address}`
      : restaurantName

    console.log('[Google Places] Searching for:', query)

    // Google Places Text Search (New) API
    const url = 'https://places.googleapis.com/v1/places:searchText'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.photos,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'de', // German results
        maxResultCount: 1, // Only best match
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Google Places] API error:', error)
      return null
    }

    const data = await response.json()

    // No results found
    if (!data.places || data.places.length === 0) {
      console.log('[Google Places] No restaurant found for query:', query)
      return null
    }

    const place = data.places[0]

    // Extract place ID (format: "places/ChIJ...")
    const placeId = place.id.replace('places/', '')

    // Build Google Maps URL
    const googleMapsUrl =
      place.googleMapsUri ||
      `https://www.google.com/maps/place/?q=place_id:${placeId}`

    // Build Review URL
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`

    // Optional: First photo URL
    let photoUrl: string | undefined
    if (place.photos && place.photos.length > 0) {
      const photoName = place.photos[0].name
      photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxHeightPx=400&maxWidthPx=400`
    }

    const result = {
      placeId,
      name: place.displayName?.text || restaurantName,
      formattedAddress: place.formattedAddress || 'Adresse nicht verfügbar',
      googleMapsUrl,
      reviewUrl,
      photoUrl,
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
    }

    console.log('[Google Places] Found restaurant:', result.name, result.placeId)

    return result
  } catch (error) {
    console.error('[Google Places] Error searching restaurant:', error)
    return null
  }
}

/**
 * Validate if a place ID is valid (optional - for debugging)
 */
export async function validatePlaceId(placeId: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return false

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id',
      },
    })
    return response.ok
  } catch {
    return false
  }
}
