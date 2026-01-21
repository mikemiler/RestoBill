'use client'

import { useState, useEffect, useRef } from 'react'
import SplitForm from './SplitForm'
import CompletionMessage from './CompletionMessage'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'
import { debugLog, debugError } from '@/lib/debug'
import confetti from 'canvas-confetti'

interface DatabaseSelection {
  id: string
  billId: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH' | null
  status: 'SELECTING' | 'PAID'
  sessionId?: string  // Optional - only present for live selections
  createdAt: string
}

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

interface SplitFormContainerProps {
  billId: string
  shareToken: string
  payerName: string
  paypalHandle: string | null
  items: BillItem[]
  itemRemainingQuantities: Record<string, number>
  totalAmount: number
  allSelectionsFromParent?: DatabaseSelection[] // NEW: Selections passed from parent to avoid duplicate fetching
  isOwner?: boolean
}

export default function SplitFormContainer({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items: initialItems,
  itemRemainingQuantities: initialRemainingQuantities,
  totalAmount,
  allSelectionsFromParent,
  isOwner = false,
}: SplitFormContainerProps) {
  const [allSelections, setAllSelections] = useState<DatabaseSelection[]>(allSelectionsFromParent || [])
  const [items, setItems] = useState<BillItem[]>(initialItems)
  const [itemRemainingQuantities, setItemRemainingQuantities] = useState<Record<string, number>>(initialRemainingQuantities)
  const [loading, setLoading] = useState(true)
  const [showCompletionMessage, setShowCompletionMessage] = useState(false)
  const hasShownCompletionRef = useRef(false) // Track if we've already shown completion

  // Confetti animation
  const fireConfetti = () => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: NodeJS.Timeout = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)
  }

  // If selections are provided from parent, use them instead of fetching
  const useParentSelections = !!allSelectionsFromParent

  // Update allSelections when parent selections change
  useEffect(() => {
    if (useParentSelections && allSelectionsFromParent) {
      debugLog('[SplitFormContainer] Using selections from parent:', allSelectionsFromParent.length)
      setAllSelections(allSelectionsFromParent)
      setLoading(false) // Set loading to false when using parent selections
    }
  }, [allSelectionsFromParent, useParentSelections])

  // CRITICAL: Sync items state with parent props when they change (Owner only)
  // For guests, items come from server-render and don't change
  // For owner, parent (StatusPageClient) fetches items and passes as props
  useEffect(() => {
    debugLog('🔄 [SplitFormContainer DEBUG] ===== ITEMS SYNC FROM PARENT =====')
    debugLog('[SplitFormContainer DEBUG] initialItems prop:', {
      isOwner,
      propsCount: initialItems.length,
      propsData: initialItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      }))
    })
    if (isOwner) {
      debugLog('[SplitFormContainer DEBUG] ✅ Owner mode: Syncing items from parent')
      setItems(initialItems)
    } else {
      debugLog('[SplitFormContainer DEBUG] ⏭️ Guest mode: Skipping sync (items from server-render)')
    }
    debugLog('🔄 [SplitFormContainer DEBUG] ===== ITEMS SYNC FROM PARENT END =====')
  }, [initialItems, isOwner])

  // Fetch items from API
  const fetchItems = async () => {
    debugLog('📥 [SplitFormContainer DEBUG] ===== FETCH ITEMS START =====')
    debugLog('[SplitFormContainer DEBUG] Fetching items from API for billId:', billId)
    try {
      const response = await fetch(`/api/bills/${billId}/items`)
      if (!response.ok) {
        debugError('❌ [SplitFormContainer DEBUG] Error fetching items:', response.statusText)
        debugLog('📥 [SplitFormContainer DEBUG] ===== FETCH ITEMS END (ERROR) =====')
        return
      }
      const data: BillItem[] = await response.json()
      debugLog('[SplitFormContainer DEBUG] ✅ Fetched items from API:', {
        count: data.length,
        items: data.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit
        }))
      })
      debugLog('[SplitFormContainer DEBUG] Calling setItems() with fetched data')
      setItems(data)
      debugLog('📥 [SplitFormContainer DEBUG] ===== FETCH ITEMS END (SUCCESS) =====')
    } catch (error) {
      debugError('❌ [SplitFormContainer DEBUG] Error fetching items:', error)
      debugLog('📥 [SplitFormContainer DEBUG] ===== FETCH ITEMS END (ERROR) =====')
    }
  }

  // Fetch selections based on user role
  // NEW ARCHITECTURE: ALL selections have status='SELECTING'
  // We filter by 'paymentMethod' and 'paid' flag client-side based on user role
  // WORKAROUND: Use /live-selections endpoint (works on Vercel, /selections returns [] for unknown reason)
  const fetchSelections = async () => {
    try {
      debugLog('[SplitFormContainer] Fetching all selections...')

      const response = await fetch(`/api/bills/${billId}/live-selections`)
      const allData: DatabaseSelection[] = await response.json()

      if (isOwner) {
        // Owner sees ALL selections (status='SELECTING' regardless of paid flag)
        // Used for calculating remaining quantities
        debugLog('[SplitFormContainer] Owner selections fetched:', {
          total: allData.length,
          liveSelecting: allData.filter(s => !s.paymentMethod).length,
          submitted: allData.filter(s => s.paymentMethod && !s.paid).length,
          confirmed: allData.filter(s => s.paymentMethod && s.paid).length
        })
        setAllSelections(allData)
      } else {
        // Guest only sees submitted selections (paymentMethod !== null) - payment history
        const submittedOnly = allData.filter(s => s.paymentMethod !== null)
        debugLog('[SplitFormContainer] Guest selections fetched:', {
          submitted: submittedOnly.length
        })
        setAllSelections(submittedOnly)
      }
      setLoading(false)
    } catch (error) {
      debugError('[SplitFormContainer] Error fetching selections:', error)
      setLoading(false)
    }
  }

  // Recalculate remaining quantities when items or selections change
  // Uses safe access to handle empty or malformed itemQuantities
  useEffect(() => {
    debugLog('[SplitFormContainer] Recalculating remaining quantities:', {
      itemCount: items.length,
      selectionCount: allSelections.length
    })

    const claimed: Record<string, number> = {}

    // Calculate claimed quantities from ALL selections (status='SELECTING')
    // This includes both submitted (paid=false) and confirmed (paid=true) selections
    allSelections.forEach((selection) => {
      const itemQuantities = selection.itemQuantities as Record<string, number> | null
      if (itemQuantities && typeof itemQuantities === 'object') {
        Object.entries(itemQuantities).forEach(([itemId, quantity]) => {
          // Safe access: ensure quantity is a valid number
          const qty = typeof quantity === 'number' ? quantity : 0
          claimed[itemId] = (claimed[itemId] || 0) + qty
        })
      }
    })

    // Calculate remaining for each item
    const remaining: Record<string, number> = {}
    items.forEach(item => {
      const claimedQty = claimed[item.id] || 0
      remaining[item.id] = Math.max(0, item.quantity - claimedQty)
    })

    debugLog('[SplitFormContainer] Remaining quantities calculated:', {
      claimed,
      remaining
    })

    setItemRemainingQuantities(remaining)

    // Check if all items are 100% selected (completion check)
    const allItemsComplete = items.length > 0 && items.every(item => {
      const claimedQty = claimed[item.id] || 0
      return claimedQty >= item.quantity
    })

    // Fire confetti and show message only once when completion is reached
    if (allItemsComplete && !hasShownCompletionRef.current) {
      debugLog('[SplitFormContainer] 🎉 All items are 100% selected! Triggering confetti...')
      hasShownCompletionRef.current = true
      fireConfetti()
      setShowCompletionMessage(true)
    }

    // Reset completion flag if items are no longer 100% complete
    if (!allItemsComplete && hasShownCompletionRef.current) {
      debugLog('[SplitFormContainer] Items no longer 100% complete, resetting flag')
      hasShownCompletionRef.current = false
    }
  }, [items, allSelections])

  // Debounced fetch functions to prevent race conditions from rapid updates
  const debouncedFetchSelections = useDebounce(fetchSelections, 100)
  const debouncedFetchItems = useDebounce(fetchItems, 500) // Wait for DB replication + cache

  // Realtime subscription for Selection changes and BillItem broadcasts
  // NEW ARCHITECTURE: All selections have status='SELECTING', only 'paid' flag differs
  // IMPORTANT: Only subscribe if selections are NOT provided from parent (to avoid duplicate subscriptions)
  // CRITICAL: Use unique channel suffix to avoid conflicts with other subscriptions
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: useParentSelections ? undefined : async () => {
      debugLog('[SplitFormContainer] Initial fetch triggered')
      await fetchSelections()
      // Don't fetch items initially - use props instead
    },

    // Selection table changes (ANY Selection change)
    // NEW ARCHITECTURE: Fires on ANY INSERT/UPDATE/DELETE (status always 'SELECTING')
    // Uses debounced version to prevent race conditions from rapid updates
    // Skip subscription if using parent selections (parent component handles realtime updates)
    onSelectionChange: useParentSelections ? undefined : () => {
      debugLog('[SplitFormContainer] Selection change detected - refetching all selections')
      debouncedFetchSelections()
    },

    // Item changes broadcast from owner
    // CRITICAL: Skip if isOwner - parent (StatusPageClient) handles item fetching
    // This prevents race condition where both parent and container fetch items
    onItemChange: isOwner ? undefined : () => {
      debugLog('🔔 [SplitFormContainer DEBUG] ===== ITEM CHANGE EVENT =====')
      debugLog('[SplitFormContainer DEBUG] Item change detected via realtime subscription')
      debugLog('[SplitFormContainer DEBUG] Current items state before refetch:', {
        count: items.length,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit
        }))
      })
      debugLog('[SplitFormContainer DEBUG] Calling debouncedFetchItems() with 500ms delay')
      debouncedFetchItems()
      debugLog('🔔 [SplitFormContainer DEBUG] ===== ITEM CHANGE EVENT END =====')
    },

    // Unique channel suffix to avoid conflicts with other subscriptions
    channelSuffix: 'container',

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development'
  })

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Lade Selections...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
        Deine Auswahl
      </h2>
      <SplitForm
        billId={billId}
        shareToken={shareToken}
        payerName={payerName}
        paypalHandle={paypalHandle}
        items={items}
        itemRemainingQuantities={itemRemainingQuantities}
        totalAmount={totalAmount}
        allSelections={allSelections}
        isOwner={isOwner}
      />

      {/* Completion Message Modal */}
      {showCompletionMessage && (
        <CompletionMessage onDismiss={() => setShowCompletionMessage(false)} />
      )}
    </div>
  )
}
