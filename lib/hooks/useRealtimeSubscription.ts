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
  // Selection table changes - ANY changes to Selection table
  // NEW ARCHITECTURE: All selections have status='SELECTING', only 'paid' flag differs
  // Fired on INSERT, UPDATE, DELETE of any Selection
  onSelectionChange?: () => void | Promise<void>

  // Active selection changes - live tracking updates
  // NEW ARCHITECTURE: Same as onSelectionChange (both fire on ANY Selection change)
  // Kept for backward compatibility with existing components
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

  // Optional channel suffix to avoid conflicts when multiple components subscribe to same bill
  // Example: "status" → creates channel "bill:${billId}:status"
  channelSuffix?: string
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
    channelSuffix,
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

    // Create unique channel name with optional suffix to avoid conflicts
    const channelName = channelSuffix ? `bill:${billId}:${channelSuffix}` : `bill:${billId}`
    log(`Subscribing to ${channelName}`)

    try {
      // Create single channel for this bill
      const channel = supabase.channel(channelName)

      // Subscribe to Selection table changes (unified table - ALL selections have status='SELECTING')
      // NEW ARCHITECTURE: status always 'SELECTING', only 'paid' flag changes (false/true)
      if (onSelectionChange || onActiveSelectionChange) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Selection'
            // NOTE: Filter removed - client-side filtering instead to avoid schema mismatch errors
          },
          async (payload) => {
            const timestamp = new Date().toISOString()
            console.log(`\n⚡ [Realtime ${timestamp}] ===== SELECTION CHANGE EVENT =====`)

            // Extract data from payload
            const newRecord = payload.new as any
            const oldRecord = payload.old as any

            // CLIENT-SIDE FILTER: Only process events for this bill
            const recordBillId = newRecord?.billId || oldRecord?.billId
            if (recordBillId !== billId) {
              log('❌ Ignoring Selection change for different bill:', recordBillId, '(expected:', billId, ')')
              console.log('[Realtime] ===== SELECTION CHANGE EVENT END (IGNORED) =====\n')
              return
            }

            const newPaid = newRecord?.paid
            const oldPaid = oldRecord?.paid
            const newPaymentMethod = newRecord?.paymentMethod
            const oldPaymentMethod = oldRecord?.paymentMethod
            const newItemQuantities = newRecord?.itemQuantities
            const oldItemQuantities = oldRecord?.itemQuantities
            const newFriendName = newRecord?.friendName
            const oldFriendName = oldRecord?.friendName

            console.log('[Realtime] 📦 FULL PAYLOAD:', {
              eventType: payload.eventType,
              table: payload.table,
              schema: payload.schema,
              billId: recordBillId,
              hasOld: !!payload.old,
              hasNew: !!payload.new,
              commitTimestamp: payload.commit_timestamp
            })

            console.log('[Realtime] 📝 OLD RECORD:', oldRecord ? {
              id: oldRecord.id?.substring(0, 8),
              friendName: oldFriendName,
              itemQuantities: oldItemQuantities,
              itemCount: oldItemQuantities ? Object.keys(oldItemQuantities).length : 0,
              tipAmount: oldRecord.tipAmount,
              paid: oldPaid,
              paymentMethod: oldPaymentMethod,
              status: oldRecord.status
            } : null)

            console.log('[Realtime] 🆕 NEW RECORD:', newRecord ? {
              id: newRecord.id?.substring(0, 8),
              friendName: newFriendName,
              itemQuantities: newItemQuantities,
              itemCount: newItemQuantities ? Object.keys(newItemQuantities).length : 0,
              tipAmount: newRecord.tipAmount,
              paid: newPaid,
              paymentMethod: newPaymentMethod,
              status: newRecord.status
            } : null)

            console.log('[Realtime] 🔄 CHANGES DETECTED:', {
              eventType: payload.eventType,
              paidChanged: oldPaid !== newPaid,
              paymentMethodChanged: oldPaymentMethod !== newPaymentMethod,
              itemQuantitiesChanged: JSON.stringify(oldItemQuantities) !== JSON.stringify(newItemQuantities),
              friendNameChanged: oldFriendName !== newFriendName
            })

            try {
              // NEW ARCHITECTURE: All selections have status='SELECTING'
              // We differentiate by 'paid' flag and 'paymentMethod':
              // - paymentMethod=null → Live selection (guest is still choosing)
              // - paymentMethod set, paid=false → Submitted, awaiting payer confirmation
              // - paymentMethod set, paid=true → Confirmed by payer

              // Fire BOTH callbacks if both are defined
              // This allows StatusPageClient (guest list) AND SplitForm (badges) to update simultaneously
              if (onSelectionChange) {
                console.log('[Realtime] 🔥 Firing onSelectionChange callback')
                await onSelectionChange()
                console.log('[Realtime] ✅ onSelectionChange callback completed')
              } else {
                console.log('[Realtime] ⚠️ onSelectionChange callback NOT defined')
              }

              if (onActiveSelectionChange) {
                console.log('[Realtime] 🔥 Firing onActiveSelectionChange callback')
                await onActiveSelectionChange()
                console.log('[Realtime] ✅ onActiveSelectionChange callback completed')
              } else {
                console.log('[Realtime] ⚠️ onActiveSelectionChange callback NOT defined')
              }

              console.log('[Realtime] ===== SELECTION CHANGE EVENT END (SUCCESS) =====\n')
            } catch (error) {
              logError('❌ Error in Selection change handlers:', error)
              onError?.(error instanceof Error ? error : new Error(String(error)))
              console.log('[Realtime] ===== SELECTION CHANGE EVENT END (ERROR) =====\n')
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
  }, [billId, channelSuffix]) // Re-subscribe if billId or channelSuffix changes

  // Handle page visibility changes (mobile tab switching, screen off/on)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        log('Page became visible - checking connection...')

        // If we think we're connected but page was hidden, force reconnect
        // This handles cases where mobile browsers silently close WebSocket
        if (connectionStatus === 'CONNECTED' || connectionStatus === 'CONNECTING') {
          log('Forcing reconnect after page visibility change')
          reconnect()
        }
      } else {
        log('Page became hidden')
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [connectionStatus])

  return {
    isConnected: connectionStatus === 'CONNECTED',
    connectionStatus,
    reconnect
  }
}
