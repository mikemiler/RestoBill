'use client'

import { useState, useEffect } from 'react'
import SplitForm from './SplitForm'
import SelectionSummary from './SelectionSummary'
import { getOrCreateSessionId } from '@/lib/sessionStorage'
import { useRealtimeSubscription } from '@/lib/hooks'

interface DatabaseSelection {
  id: string
  billId: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH'
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
  isOwner = false,
}: SplitFormContainerProps) {
  const [allSelections, setAllSelections] = useState<DatabaseSelection[]>([])
  const [mySelections, setMySelections] = useState<DatabaseSelection[]>([])
  const [items, setItems] = useState<BillItem[]>(initialItems)
  const [itemRemainingQuantities, setItemRemainingQuantities] = useState<Record<string, number>>(initialRemainingQuantities)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string>('')

  // Initialize sessionId on mount
  useEffect(() => {
    setSessionId(getOrCreateSessionId())
  }, [])

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

  // Fetch all PAID selections from API (all guests)
  // This is the single source of truth for PAID selections
  const fetchSelections = async () => {
    try {
      console.log('[SplitFormContainer] Fetching PAID selections...')
      const response = await fetch(`/api/bills/${billId}/selections`)
      const data: DatabaseSelection[] = await response.json()
      console.log('[SplitFormContainer] PAID selections fetched:', {
        count: data.length,
        selections: data.map(s => ({
          id: s.id,
          friendName: s.friendName,
          itemCount: Object.keys(s.itemQuantities || {}).length,
          itemQuantities: s.itemQuantities
        }))
      })
      setAllSelections(data)
      setLoading(false)
    } catch (error) {
      console.error('[SplitFormContainer] Error fetching PAID selections:', error)
      setLoading(false)
    }
  }

  // Fetch my selections from API (this session only)
  const fetchMySelections = async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/selections/session?billId=${billId}&sessionId=${sessionId}`)
      if (!response.ok) {
        console.error('Error fetching my selections:', response.statusText)
        return
      }
      const data: DatabaseSelection[] = await response.json()
      setMySelections(data)
    } catch (error) {
      console.error('Error fetching my selections:', error)
    }
  }

  // Fetch my selections when sessionId is available
  useEffect(() => {
    if (sessionId) {
      fetchMySelections()
    }
  }, [sessionId, billId])

  // Recalculate remaining quantities when items or selections change
  // Uses safe access to handle empty or malformed itemQuantities
  useEffect(() => {
    console.log('[SplitFormContainer] Recalculating remaining quantities:', {
      itemCount: items.length,
      selectionCount: allSelections.length
    })

    const claimed: Record<string, number> = {}

    // Calculate claimed quantities from PAID selections only
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

  // Realtime subscription for Selection changes and BillItem broadcasts
  // This is the PRIMARY subscription for PAID selections (status='PAID')
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      console.log('[SplitFormContainer] Initial fetch triggered')
      await fetchSelections()
      await fetchMySelections()
      // Don't fetch items initially - use props instead
    },

    // Selection table changes (final payments)
    // This triggers when a new payment is created or updated (SELECTING → PAID)
    onSelectionChange: () => {
      console.log('[SplitFormContainer] Selection change detected - refetching PAID selections')
      fetchSelections()
      fetchMySelections()
    },

    // Item changes broadcast from owner
    onItemChange: () => {
      console.log('[SplitFormContainer] Item change detected - refetching items')
      // Refetch items when broadcast is received
      fetchItems()
    },

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

  // Determine which selections to show in summary
  // Owner sees ALL selections, guests see only their own
  const selectionsToShow = isOwner ? allSelections : mySelections

  return (
    <>
      {selectionsToShow.length > 0 && (
        <SelectionSummary
          selections={selectionsToShow}
          items={items}
        />
      )}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
          {selectionsToShow.length > 0 ? 'Weitere Position auswählen' : 'Deine Auswahl'}
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
    </>
  )
}
