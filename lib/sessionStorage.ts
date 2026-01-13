/**
 * Session management for unique browser identification
 * Each browser session gets a unique UUID that persists across page reloads
 */

const SESSION_ID_KEY = 'userSessionId'

/**
 * Get or create sessionId for this browser
 * SessionId persists across page reloads but is unique per browser
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  try {
    let sessionId = localStorage.getItem(SESSION_ID_KEY)

    if (!sessionId) {
      // Generate new UUID v4
      sessionId = crypto.randomUUID()
      localStorage.setItem(SESSION_ID_KEY, sessionId)
    }

    return sessionId
  } catch (error) {
    console.error('Error managing sessionId:', error)
    // Fallback: generate temporary session ID (won't persist)
    return crypto.randomUUID()
  }
}

/**
 * Get current sessionId (returns empty string if not exists)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  try {
    return localStorage.getItem(SESSION_ID_KEY) || ''
  } catch (error) {
    console.error('Error reading sessionId:', error)
    return ''
  }
}

/**
 * Clear sessionId (for testing/debugging only)
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(SESSION_ID_KEY)
  } catch (error) {
    console.error('Error clearing sessionId:', error)
  }
}
