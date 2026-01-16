'use client'

import { useState, useEffect } from 'react'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'
import GuestSelectionsList from './GuestSelectionsList'
import SplitFormContainer from './SplitFormContainer'

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
  items,
  itemRemainingQuantities,
  totalBillAmount,
}: StatusPageClientProps) {
  const [selections, setSelections] = useState<Selection[]>([])

  // Fetch all selections (all have status='SELECTING' in new architecture)
  const fetchSelections = async () => {
    const timestamp = new Date().toISOString()
    console.log(`🔍 [StatusPageClient ${timestamp}] ===== FETCHING SELECTIONS START =====`)
    console.log(`[StatusPageClient] 📍 Fetching from: /api/bills/${billId}/selections`)

    try {
      const response = await fetch(`/api/bills/${billId}/selections`)
      console.log(`[StatusPageClient] 📡 Response status:`, response.status, response.statusText)

      const allData = await response.json()
      console.log(`[StatusPageClient] 📥 RAW DATA from API:`, {
        count: allData.length,
        rawData: allData.map((s: Selection) => ({
          id: s.id,
          friendName: s.friendName,
          paid: s.paid,
          paymentMethod: s.paymentMethod,
          status: s.status,
          itemCount: Object.keys(s.itemQuantities || {}).length,
          tipAmount: s.tipAmount
        }))
      })

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

      console.log(`[StatusPageClient] ✅ FILTERED SELECTIONS:`, {
        valid: validSelections.length,
        liveSelections: validSelections.filter((s: Selection) => !s.paymentMethod).length,
        submittedSelections: validSelections.filter((s: Selection) => s.paymentMethod && !s.paid).length,
        paidSelections: validSelections.filter((s: Selection) => s.paid).length,
        data: validSelections.map((s: Selection) => ({
          id: s.id,
          friendName: s.friendName,
          paid: s.paid,
          paymentMethod: s.paymentMethod
        }))
      })

      setSelections(validSelections)
      console.log(`[StatusPageClient] ✅ State updated with ${validSelections.length} selections`)
      console.log(`[StatusPageClient] ===== FETCHING SELECTIONS END =====`)
    } catch (error) {
      console.error('❌ [StatusPageClient] Error fetching selections:', error)
      console.log(`[StatusPageClient] ===== FETCHING SELECTIONS END (ERROR) =====`)
    }
  }

  // Debounced version to prevent race conditions from rapid updates
  const debouncedFetchSelections = useDebounce(fetchSelections, 100)

  // Realtime subscription for Selection changes
  // CRITICAL: Use unique channel suffix to avoid conflicts with SplitForm's subscription
  // Without this, Supabase Realtime will only deliver events to ONE subscription (the last one created)
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: fetchSelections,

    // Selection table changes (INSERT, UPDATE, DELETE)
    // Uses debounced version to prevent race conditions from rapid updates
    onSelectionChange: debouncedFetchSelections,

    // Unique channel suffix to avoid conflicts with other subscriptions
    channelSuffix: 'status',
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
    </>
  )
}
