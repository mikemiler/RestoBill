'use client'

import { useState, useEffect } from 'react'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'
import { debugLog, debugError } from '@/lib/debug'
import GuestSelectionsList from './GuestSelectionsList'
import SplitFormContainer from './SplitFormContainer'
import DonationBanner from './DonationBanner'

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

interface Selection {
  id: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH' | null
  status: 'SELECTING' | 'PAID'
  sessionId?: string  // Optional - only present for live selections
  createdAt: string
}

interface StatusPageClientProps {
  billId: string
  shareToken: string
  payerName: string
  paypalHandle: string | null
  items: BillItem[]
  itemRemainingQuantities: Record<string, number>
  totalBillAmount: number
}

export default function StatusPageClient({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items: initialItems,
  itemRemainingQuantities: initialRemainingQuantities,
  totalBillAmount,
}: StatusPageClientProps) {
  const [selections, setSelections] = useState<Selection[]>([])
  const [items, setItems] = useState<BillItem[]>(initialItems)
  const [itemRemainingQuantities, setItemRemainingQuantities] = useState<Record<string, number>>(initialRemainingQuantities)

  // Fetch items from API
  const fetchItems = async () => {
    debugLog('📥 [StatusPageClient DEBUG] ===== FETCH ITEMS START =====')
    debugLog('[StatusPageClient DEBUG] Fetching items from API for billId:', billId)
    try {
      const response = await fetch(`/api/bills/${billId}/items`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data: BillItem[] = await response.json()
      debugLog('[StatusPageClient DEBUG] ✅ Fetched items from API:', {
        count: data.length,
        items: data.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice
        }))
      })
      debugLog('[StatusPageClient DEBUG] Calling setItems() with fetched data')
      setItems(data)
      debugLog('[StatusPageClient DEBUG] setItems() called - state will update on next render')
      debugLog('📥 [StatusPageClient DEBUG] ===== FETCH ITEMS END (SUCCESS) =====')
    } catch (error) {
      debugError('❌ [StatusPageClient DEBUG] Error fetching items:', error)
      debugLog('📥 [StatusPageClient DEBUG] ===== FETCH ITEMS END (ERROR) =====')
    }
  }

  // Fetch all selections (all have status='SELECTING' in new architecture)
  const fetchSelections = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/live-selections`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const allData = await response.json()

      // Filter out only completely empty selections with no useful data
      // CRITICAL: Submitted selections (with paymentMethod) must ALWAYS be shown!
      // Only apply strict filtering to live selections (paymentMethod=null)
      const validSelections = allData.filter((s: Selection) => {
        // If selection has paymentMethod, it's submitted → ALWAYS show it!
        // Don't filter out submitted selections even if items/tip/name are empty
        const isSubmitted = !!s.paymentMethod
        if (isSubmitted) return true

        // For live selections (no paymentMethod), apply stricter filter
        const hasItems = s.itemQuantities && Object.keys(s.itemQuantities).length > 0
        const hasTip = s.tipAmount && s.tipAmount > 0
        const hasName = s.friendName && s.friendName.trim().length > 0

        // Show if: has items OR has tip OR has name
        // This includes live selections that are still being built
        return hasItems || hasTip || hasName
      })

      setSelections(validSelections)
    } catch (error) {
      debugError('[StatusPageClient] Error fetching selections:', error)
    }
  }

  // Debounced versions to prevent race conditions from rapid updates
  const debouncedFetchSelections = useDebounce(fetchSelections, 100)
  const debouncedFetchItems = useDebounce(fetchItems, 500) // Wait for DB replication + cache

  // Recalculate remaining quantities when items or selections change
  // IMPORTANT: Exclude owner's own selection from the calculation (like in SplitForm)
  // This allows the owner to change their own selection without being blocked
  useEffect(() => {
    debugLog('🔄 [StatusPageClient DEBUG] ===== RECALCULATE REMAINING QUANTITIES =====')
    debugLog('[StatusPageClient DEBUG] Items state changed, recalculating:', {
      itemsCount: items.length,
      selectionsCount: selections.length,
      itemsData: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      }))
    })

    // Get owner's sessionId from localStorage (like guests do)
    const ownerSessionId = typeof window !== 'undefined'
      ? localStorage.getItem('userSessionId')
      : null

    const claimed: Record<string, number> = {}

    // Calculate claimed quantities from ALL selections EXCEPT owner's own live selection
    // This allows the owner to freely change their own selection
    selections.forEach((selection) => {
      // Skip owner's own live selection (paymentMethod=null means still selecting)
      const isOwnerLiveSelection = selection.paymentMethod === null &&
        ownerSessionId &&
        'sessionId' in selection &&
        (selection as any).sessionId === ownerSessionId

      if (isOwnerLiveSelection) {
        debugLog('[StatusPageClient DEBUG] Skipping owner\'s own live selection from claimed calculation')
        return
      }

      const itemQuantities = selection.itemQuantities as Record<string, number> | null
      if (itemQuantities && typeof itemQuantities === 'object') {
        Object.entries(itemQuantities).forEach(([itemId, quantity]) => {
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

    debugLog('[StatusPageClient DEBUG] ✅ Remaining quantities calculated:', {
      ownerSessionId,
      claimed,
      remaining
    })
    setItemRemainingQuantities(remaining)
    debugLog('🔄 [StatusPageClient DEBUG] ===== RECALCULATE REMAINING QUANTITIES END =====')
  }, [items, selections])

  // Realtime subscription for Selection changes and Item changes
  // CRITICAL: Use unique channel suffix to avoid conflicts with SplitForm's subscription
  // Without this, Supabase Realtime will only deliver events to ONE subscription (the last one created)
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: fetchSelections,

    // Selection table changes (INSERT, UPDATE, DELETE)
    // Uses debounced version to prevent race conditions from rapid updates
    onSelectionChange: debouncedFetchSelections,

    // Item changes broadcast from owner (when items are created/updated/deleted)
    // Uses debounced version to wait for DB replication (prevents stale data)
    onItemChange: () => {
      debugLog('🔔 [StatusPageClient DEBUG] ===== ITEM CHANGE EVENT =====')
      debugLog('[StatusPageClient DEBUG] Item change detected via realtime subscription')
      debugLog('[StatusPageClient DEBUG] Current items state before refetch:', {
        count: items.length,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice
        }))
      })
      debugLog('[StatusPageClient DEBUG] Calling debouncedFetchItems() with 500ms delay')
      debouncedFetchItems()
      debugLog('🔔 [StatusPageClient DEBUG] ===== ITEM CHANGE EVENT END =====')
    },

    // Unique channel suffix to avoid conflicts with other subscriptions
    channelSuffix: 'status',

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development'
  })

  return (
    <>
      {/* Guest Selections List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6 mb-4 md:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
          👥 Gäste & Zahlungen
          {isConnected && (
            <span className="text-xs text-green-600 dark:text-green-400 font-normal">● Live</span>
          )}
        </h2>
        <GuestSelectionsList
          items={items}
          selections={selections}
          isOwner={true}
        />
      </div>

      {/* Selection Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6 mb-4 md:mb-8">
        <SplitFormContainer
          billId={billId}
          shareToken={shareToken}
          payerName={payerName}
          paypalHandle={paypalHandle}
          items={items}
          itemRemainingQuantities={itemRemainingQuantities}
          totalAmount={totalBillAmount}
          allSelectionsFromParent={selections}
          isOwner={true}
        />
      </div>

      {/* Donation Banner */}
      <DonationBanner />
    </>
  )
}
