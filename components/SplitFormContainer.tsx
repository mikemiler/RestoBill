'use client'

import { useState, useEffect } from 'react'
import SplitForm from './SplitForm'
import SelectionSummary from './SelectionSummary'
import { getSelectionsByToken } from '@/lib/selectionStorage'
import type { SavedSelection } from '@/lib/selectionStorage'
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
  paypalHandle: string
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
  const [items, setItems] = useState<BillItem[]>(initialItems)
  const [itemRemainingQuantities, setItemRemainingQuantities] = useState<Record<string, number>>(initialRemainingQuantities)
  const [loading, setLoading] = useState(true)

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

  // Fetch all selections from API (all guests)
  const fetchSelections = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/selections`)
      const data: DatabaseSelection[] = await response.json()
      setAllSelections(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching selections:', error)
      setLoading(false)
    }
  }

  // Recalculate remaining quantities when items or selections change
  useEffect(() => {
    const claimed: Record<string, number> = {}

    // Calculate claimed quantities from selections
    allSelections.forEach((selection) => {
      const itemQuantities = selection.itemQuantities as Record<string, number> | null
      if (itemQuantities) {
        Object.entries(itemQuantities).forEach(([itemId, quantity]) => {
          claimed[itemId] = (claimed[itemId] || 0) + quantity
        })
      }
    })

    // Calculate remaining for each item
    const remaining: Record<string, number> = {}
    items.forEach(item => {
      const claimedQty = claimed[item.id] || 0
      remaining[item.id] = Math.max(0, item.quantity - claimedQty)
    })

    setItemRemainingQuantities(remaining)
  }, [items, allSelections])

  // Realtime subscription for Selection changes and BillItem broadcasts
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      await fetchSelections()
      // Don't fetch items initially - use props instead
    },

    // Selection table changes (final payments)
    onSelectionChange: () => {
      fetchSelections()
    },

    // Item changes broadcast from owner
    onItemChange: () => {
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

  return (
    <>
      {allSelections.length > 0 && (
        <SelectionSummary
          selections={allSelections}
          items={items}
        />
      )}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
          {allSelections.length > 0 ? 'Weitere Position auswählen' : 'Deine Auswahl'}
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
