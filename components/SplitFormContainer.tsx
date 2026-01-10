'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import SplitForm from './SplitForm'
import SelectionSummary from './SelectionSummary'
import { getSelectionsByToken } from '@/lib/selectionStorage'
import type { SavedSelection } from '@/lib/selectionStorage'

// Browser-only Supabase client
const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : null

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
}

export default function SplitFormContainer({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items,
  itemRemainingQuantities,
}: SplitFormContainerProps) {
  const [allSelections, setAllSelections] = useState<DatabaseSelection[]>([])
  const [loading, setLoading] = useState(true)

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

  // Supabase Realtime subscription for Selection table
  useEffect(() => {
    if (!supabase) return

    // Initial fetch
    fetchSelections()

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`bill-selections:${billId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Selection',
          filter: `billId=eq.${billId}`
        },
        () => {
          // Refetch all selections when any change occurs
          fetchSelections()
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [billId])

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
        />
      </div>
    </>
  )
}
