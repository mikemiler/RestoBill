'use client'

import { useState, useEffect } from 'react'
import SplitForm from './SplitForm'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'

interface DatabaseSelection {
  id: string
  billId: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH'
  status: 'SELECTING' | 'PAID'
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

  // If selections are provided from parent, use them instead of fetching
  const useParentSelections = !!allSelectionsFromParent

  // Update allSelections when parent selections change
  useEffect(() => {
    if (useParentSelections && allSelectionsFromParent) {
      console.log('[SplitFormContainer] Using selections from parent:', allSelectionsFromParent.length)
      setAllSelections(allSelectionsFromParent)
      setLoading(false) // Set loading to false when using parent selections
    }
  }, [allSelectionsFromParent, useParentSelections])

  // Fetch items from API
  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/items`)
      if (!response.ok) {
        console.error('Error fetching items:', response.statusText)
        return
      }
      const data: BillItem[] = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  // Fetch selections based on user role
  // NEW ARCHITECTURE: ALL selections have status='SELECTING'
  // We filter by 'paymentMethod' and 'paid' flag client-side based on user role
  const fetchSelections = async () => {
    try {
      console.log('[SplitFormContainer] Fetching all selections...')

      const response = await fetch(`/api/bills/${billId}/selections`)
      const allData: DatabaseSelection[] = await response.json()

      if (isOwner) {
        // Owner sees ALL selections (status='SELECTING' regardless of paid flag)
        // Used for calculating remaining quantities
        console.log('[SplitFormContainer] Owner selections fetched:', {
          total: allData.length,
          liveSelecting: allData.filter(s => !s.paymentMethod).length,
          submitted: allData.filter(s => s.paymentMethod && !s.paid).length,
          confirmed: allData.filter(s => s.paymentMethod && s.paid).length
        })
        setAllSelections(allData)
      } else {
        // Guest only sees submitted selections (paymentMethod !== null) - payment history
        const submittedOnly = allData.filter(s => s.paymentMethod !== null)
        console.log('[SplitFormContainer] Guest selections fetched:', {
          submitted: submittedOnly.length
        })
        setAllSelections(submittedOnly)
      }
      setLoading(false)
    } catch (error) {
      console.error('[SplitFormContainer] Error fetching selections:', error)
      setLoading(false)
    }
  }

  // Recalculate remaining quantities when items or selections change
  // Uses safe access to handle empty or malformed itemQuantities
  useEffect(() => {
    console.log('[SplitFormContainer] Recalculating remaining quantities:', {
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

    console.log('[SplitFormContainer] Remaining quantities calculated:', {
      claimed,
      remaining
    })

    setItemRemainingQuantities(remaining)
  }, [items, allSelections])

  // Debounced fetch functions to prevent race conditions from rapid updates
  const debouncedFetchSelections = useDebounce(fetchSelections, 100)

  // Realtime subscription for Selection changes and BillItem broadcasts
  // NEW ARCHITECTURE: All selections have status='SELECTING', only 'paid' flag differs
  // IMPORTANT: Only subscribe if selections are NOT provided from parent (to avoid duplicate subscriptions)
  // CRITICAL: Use unique channel suffix to avoid conflicts with other subscriptions
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: useParentSelections ? undefined : async () => {
      console.log('[SplitFormContainer] Initial fetch triggered')
      await fetchSelections()
      // Don't fetch items initially - use props instead
    },

    // Selection table changes (ANY Selection change)
    // NEW ARCHITECTURE: Fires on ANY INSERT/UPDATE/DELETE (status always 'SELECTING')
    // Uses debounced version to prevent race conditions from rapid updates
    // Skip subscription if using parent selections (parent component handles realtime updates)
    onSelectionChange: useParentSelections ? undefined : () => {
      console.log('[SplitFormContainer] Selection change detected - refetching all selections')
      debouncedFetchSelections()
    },

    // Item changes broadcast from owner
    onItemChange: () => {
      console.log('[SplitFormContainer] Item change detected - refetching items')
      // Refetch items when broadcast is received
      fetchItems()
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
    </div>
  )
}
