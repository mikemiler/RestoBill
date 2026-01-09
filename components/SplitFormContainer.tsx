'use client'

import { useState, useEffect } from 'react'
import SplitForm from './SplitForm'
import SelectionSummary from './SelectionSummary'
import { getSelectionsByToken } from '@/lib/selectionStorage'
import type { SavedSelection } from '@/lib/selectionStorage'

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
  const [savedSelections, setSavedSelections] = useState<SavedSelection[]>([])

  useEffect(() => {
    // Load all saved selections for this bill on mount
    const selections = getSelectionsByToken(shareToken)
    setSavedSelections(selections)
  }, [shareToken])

  // Listen for localStorage changes (when a new selection is saved)
  useEffect(() => {
    const handleStorageChange = () => {
      const selections = getSelectionsByToken(shareToken)
      setSavedSelections(selections)
    }

    // Listen for custom event (same tab)
    window.addEventListener('selectionSaved', handleStorageChange)
    // Listen for storage event (other tabs)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('selectionSaved', handleStorageChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [shareToken])

  return (
    <>
      {savedSelections.length > 0 && (
        <SelectionSummary
          selections={savedSelections}
          items={items}
        />
      )}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
          {savedSelections.length > 0 ? 'Weitere Position auswählen' : 'Deine Auswahl'}
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
