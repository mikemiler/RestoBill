/**
 * Sanitize user input to prevent XSS attacks
 * @param input - User input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string, maxLength = 100): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
}

/**
 * Format currency amount in EUR
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Generate PayPal.me payment URL
 * @param paypalHandle - PayPal username (e.g., "maxmustermann")
 * @param amount - Amount in EUR
 * @returns PayPal.me URL with prefilled amount
 */
export function generatePayPalUrl(
  paypalHandle: string,
  amount: number
): string {
  // Round to 2 decimal places
  const roundedAmount = Math.round(amount * 100) / 100

  // PayPal.me URL format: https://paypal.me/username/amount
  return `https://paypal.me/${paypalHandle}/${roundedAmount}?locale.x=de_DE`
}

/**
 * Calculate total price for selected items with quantities
 * @param items - Array of items with pricePerUnit
 * @param itemQuantities - Object mapping itemId to quantity multiplier
 * @returns Total price
 */
export function calculateTotal(
  items: Array<{ id: string; pricePerUnit: number; quantity: number }>,
  itemQuantities: Record<string, number>
): number {
  return items.reduce((total, item) => {
    const quantityMultiplier = itemQuantities[item.id] || 0
    const itemTotal = item.pricePerUnit * item.quantity * quantityMultiplier
    return total + itemTotal
  }, 0)
}

/**
 * Validate file is an image and within size limit
 * @param file - File to validate
 * @param maxSizeMB - Maximum size in MB (default: 10)
 * @returns true if valid, error message if not
 */
export function validateImageFile(
  file: File,
  maxSizeMB = 10
): { valid: true } | { valid: false; error: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Nur JPG, PNG und HEIC Dateien sind erlaubt',
    }
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Datei zu groß. Maximum: ${maxSizeMB}MB`,
    }
  }

  return { valid: true }
}
