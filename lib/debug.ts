/**
 * Development-only debug logging utility
 * All debug logs are automatically disabled in production
 */

const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Debug log - only outputs in development mode
 * Usage: debugLog('[Component]', 'message', data)
 */
export function debugLog(...args: any[]) {
  if (isDevelopment) {
    console.log(...args)
  }
}

/**
 * Debug error - only outputs in development mode
 * Usage: debugError('[Component]', 'error message', error)
 */
export function debugError(...args: any[]) {
  if (isDevelopment) {
    console.error(...args)
  }
}

/**
 * Debug warning - only outputs in development mode
 * Usage: debugWarn('[Component]', 'warning message', data)
 */
export function debugWarn(...args: any[]) {
  if (isDevelopment) {
    console.warn(...args)
  }
}

/**
 * Check if debug mode is enabled
 * Usage: if (isDebugEnabled()) { ... }
 */
export function isDebugEnabled() {
  return isDevelopment
}
