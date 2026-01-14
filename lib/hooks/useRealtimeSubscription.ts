/**
 * Centralized Supabase Realtime Hook
 *
 * Provides connection monitoring, automatic reconnection, and unified channel management.
 * Replaces polling with pure realtime updates for optimal performance.
 *
 * Usage:
 * ```tsx
 * const { isConnected, connectionStatus } = useRealtimeSubscription(billId, {
 *   onSelectionChange: () => fetchSelections(),
 *   onActiveSelectionChange: () => fetchActiveSelections(),
 *   onItemChange: () => fetchItems()
 * })
 * ```
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

// Connection states
export type ConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'

// Event handlers
export interface RealtimeEventHandlers {
  // Selection table changes - final payments (status=PAID)
  // NOTE: Also triggers for SELECTING status changes since unified table
  onSelectionChange?: () => void | Promise<void>

  // Selection table changes - live tracking (status=SELECTING)
  // NOTE: Now uses unified Selection table (no separate ActiveSelection table)
  onActiveSelectionChange?: () => void | Promise<void>

  // Item changes (broadcast from owner)
  onItemChange?: (payload: { action: 'created' | 'updated' | 'deleted'; itemId?: string }) => void | Promise<void>

  // Connection status changes
  onConnectionStatusChange?: (status: ConnectionStatus) => void

  // Error handler
  onError?: (error: Error) => void
}

// Hook options
export interface UseRealtimeSubscriptionOptions extends RealtimeEventHandlers {
  // Enable debug logging
  debug?: boolean

  // Initial data fetch on mount (recommended)
  onInitialFetch?: () => void | Promise<void>
}

// Return type
export interface UseRealtimeSubscriptionReturn {
  isConnected: boolean
  connectionStatus: ConnectionStatus
  reconnect: () => void
}

// Singleton Supabase client (prevents multiple instances)
// Created on module load to avoid multiple GoTrueClient instances
let supabaseClient: ReturnType<typeof createClient> | null = null

const getSupabaseClient = () => {
  if (typeof window === 'undefined') return null

  // Return existing instance if available
  if (supabaseClient) return supabaseClient

  // Create new instance only once
  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false, // Disable auth session persistence for realtime-only client
      }
    }
  )

  return supabaseClient
}

/**
 * Centralized Realtime Subscription Hook
 *
 * Manages Supabase realtime subscriptions with automatic reconnection and connection monitoring.
 * Uses a single channel per bill to avoid duplicate subscriptions.
 */
export function useRealtimeSubscription(
  billId: string,
  options: UseRealtimeSubscriptionOptions = {}
): UseRealtimeSubscriptionReturn {
  const {
    onSelectionChange,
    onActiveSelectionChange,
    onItemChange,
    onConnectionStatusChange,
    onError,
    onInitialFetch,
    debug = false
  } = options

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isUnmountedRef = useRef(false)
  const isSubscribingRef = useRef(false)  // Prevent cleanup during active subscription

  const log = (...args: any[]) => {
    if (debug) console.log('[Realtime]', ...args)
  }

  const logError = (...args: any[]) => {
    if (debug) console.error('[Realtime Error]', ...args)
  }

  // Update connection status and notify
  const updateStatus = (status: ConnectionStatus) => {
    setConnectionStatus(status)
    onConnectionStatusChange?.(status)
    log('Status changed:', status)
  }

  // Calculate reconnection delay with exponential backoff
  const getReconnectDelay = (attempts: number): number => {
    // 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
    log(`Reconnect delay: ${delay}ms (attempt ${attempts + 1})`)
    return delay
  }

  // Cleanup function
  const cleanup = () => {
    log('Cleaning up...')

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (channelRef.current) {
      const supabase = getSupabaseClient()
      if (supabase) {
        supabase.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }
  }

  // Subscribe to realtime channel
  const subscribe = async () => {
    if (isUnmountedRef.current) {
      log('Skipping subscribe - component unmounted')
      return
    }

    if (isSubscribingRef.current) {
      log('Skipping subscribe - already subscribing')
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      logError('Supabase client not available')
      return
    }

    // Mark as subscribing to prevent concurrent subscriptions
    isSubscribingRef.current = true

    // Cleanup existing subscription
    cleanup()

    updateStatus('CONNECTING')
    log(`Subscribing to bill:${billId}`)

    try {
      // Create single channel for this bill
      const channel = supabase.channel(`bill:${billId}`)

      // Subscribe to Selection table changes (unified table for both SELECTING and PAID)
      // Since we now use ONE table instead of ActiveSelection + Selection,
      // we trigger BOTH callbacks on any Selection change
      if (onSelectionChange || onActiveSelectionChange) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Selection',
            filter: `billId=eq.${billId}`
          },
          async (payload) => {
            log('Selection changed (unified table)', {
              eventType: payload.eventType,
              table: payload.table,
              hasOld: !!payload.old,
              hasNew: !!payload.new
            })

            // Call both callbacks since Selection now handles both SELECTING and PAID statuses
            try {
              if (onSelectionChange) {
                await onSelectionChange()
              }
              if (onActiveSelectionChange) {
                await onActiveSelectionChange()
              }
            } catch (error) {
              logError('Error in Selection change handlers:', error)
              onError?.(error instanceof Error ? error : new Error(String(error)))
            }
          }
        )
      }

      // Subscribe to item change broadcasts
      if (onItemChange) {
        channel.on(
          'broadcast',
          { event: 'item-changed' },
          async ({ payload }) => {
            log('Item changed:', payload)
            try {
              await onItemChange(payload as any)
            } catch (error) {
              logError('Error in onItemChange:', error)
              onError?.(error instanceof Error ? error : new Error(String(error)))
            }
          }
        )
      }

      // Subscribe with status callback
      channel.subscribe(async (status, err) => {
        log('Subscription status:', status, err)

        if (status === 'SUBSCRIBED') {
          // Mark subscribing as complete
          isSubscribingRef.current = false
          updateStatus('CONNECTED')
          reconnectAttemptsRef.current = 0 // Reset attempts on success

          // Refetch data after successful (re)connection
          if (onInitialFetch) {
            log('Fetching initial data after connection')
            try {
              await onInitialFetch()
            } catch (error) {
              logError('Error in onInitialFetch:', error)
              onError?.(error instanceof Error ? error : new Error(String(error)))
            }
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Only handle CLOSED if we're not currently subscribing
          // (React Strict Mode can cause cleanup during subscription)
          if (isSubscribingRef.current) {
            log('Ignoring CLOSED status - subscription in progress')
            return
          }

          isSubscribingRef.current = false
          updateStatus('DISCONNECTED')

          if (err) {
            logError('Subscription error:', err)
            onError?.(new Error(`Realtime error: ${err}`))
          }

          // Attempt reconnection with exponential backoff
          if (!isUnmountedRef.current) {
            const delay = getReconnectDelay(reconnectAttemptsRef.current)
            reconnectAttemptsRef.current++

            updateStatus('RECONNECTING')

            reconnectTimeoutRef.current = setTimeout(() => {
              log('Attempting reconnection...')
              subscribe()
            }, delay)
          }
        } else if (status === 'TIMED_OUT') {
          isSubscribingRef.current = false
          updateStatus('DISCONNECTED')
          logError('Connection timed out')

          // Retry immediately on timeout
          if (!isUnmountedRef.current) {
            updateStatus('RECONNECTING')
            setTimeout(() => subscribe(), 1000)
          }
        }
      })

      channelRef.current = channel
      log('Channel created and subscribed')
    } catch (error) {
      isSubscribingRef.current = false
      logError('Failed to subscribe:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
      updateStatus('DISCONNECTED')

      // Retry on error
      if (!isUnmountedRef.current) {
        const delay = getReconnectDelay(reconnectAttemptsRef.current)
        reconnectAttemptsRef.current++
        updateStatus('RECONNECTING')

        reconnectTimeoutRef.current = setTimeout(() => {
          subscribe()
        }, delay)
      }
    }
  }

  // Manual reconnect function
  const reconnect = () => {
    log('Manual reconnect triggered')
    reconnectAttemptsRef.current = 0 // Reset attempts
    isSubscribingRef.current = false // Reset subscribing flag
    subscribe()
  }

  // Initialize subscription on mount
  useEffect(() => {
    isUnmountedRef.current = false

    // Initial data fetch
    if (onInitialFetch) {
      log('Initial data fetch on mount')
      onInitialFetch().catch((error) => {
        logError('Error in initial fetch:', error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      })
    }

    // Subscribe to realtime
    subscribe()

    // Cleanup on unmount
    return () => {
      log('Component unmounting, cleaning up...')
      isUnmountedRef.current = true
      isSubscribingRef.current = false  // Reset subscribing flag
      cleanup()
      updateStatus('DISCONNECTED')
    }
  }, [billId]) // Re-subscribe if billId changes

  return {
    isConnected: connectionStatus === 'CONNECTED',
    connectionStatus,
    reconnect
  }
}
