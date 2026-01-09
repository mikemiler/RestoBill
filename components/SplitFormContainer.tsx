'use client'

import { useState, useEffect } from 'react'
import SplitForm from './SplitForm'
import SelectionSummary from './SelectionSummary'
import ReviewFlow from './ReviewFlow'
import {
  getSelectionsByToken,
  getFirstUnreviewedSelection,
  markSelectionAsReviewed,
} from '@/lib/selectionStorage'
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
  restaurantName?: string | null
  googlePlaceId?: string | null
}

export default function SplitFormContainer({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items,
  itemRemainingQuantities,
  restaurantName,
  googlePlaceId,
}: SplitFormContainerProps) {
  const [savedSelections, setSavedSelections] = useState<SavedSelection[]>([])
  const [showReviewFlow, setShowReviewFlow] = useState(false)
  const [unreviewedSelection, setUnreviewedSelection] = useState<SavedSelection | null>(null)

  useEffect(() => {
    // Load all saved selections for this bill on mount
    const selections = getSelectionsByToken(shareToken)
    setSavedSelections(selections)

    // Check for unreviewed selections on mount
    const unreviewed = getFirstUnreviewedSelection(shareToken)
    if (unreviewed) {
      setUnreviewedSelection(unreviewed)
      setShowReviewFlow(true)
    }
  }, [shareToken])

  // Listen for localStorage changes (when a new selection is saved)
  useEffect(() => {
    const handleStorageChange = () => {
      const selections = getSelectionsByToken(shareToken)
      setSavedSelections(selections)

      // Check for new unreviewed selections
      if (!showReviewFlow) {
        const unreviewed = getFirstUnreviewedSelection(shareToken)
        if (unreviewed) {
          setUnreviewedSelection(unreviewed)
          setShowReviewFlow(true)
        }
      }
    }

    // Listen for custom event (same tab)
    window.addEventListener('selectionSaved', handleStorageChange)
    // Listen for storage event (other tabs)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('selectionSaved', handleStorageChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [shareToken, showReviewFlow])

  const handleReviewComplete = () => {
    // Mark selection as reviewed in localStorage
    if (unreviewedSelection) {
      markSelectionAsReviewed(unreviewedSelection.selectionId)
    }
    setShowReviewFlow(false)
    setUnreviewedSelection(null)

    // Check if there are more unreviewed selections
    setTimeout(() => {
      const nextUnreviewed = getFirstUnreviewedSelection(shareToken)
      if (nextUnreviewed) {
        setUnreviewedSelection(nextUnreviewed)
        setShowReviewFlow(true)
      }
    }, 500)
  }

  const handleReviewSkip = () => {
    // Mark as reviewed anyway (user skipped)
    if (unreviewedSelection) {
      markSelectionAsReviewed(unreviewedSelection.selectionId)
    }
    setShowReviewFlow(false)
    setUnreviewedSelection(null)
  }

  return (
    <>
      {savedSelections.length > 0 && (
        <SelectionSummary selections={savedSelections} items={items} />
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

      {/* Review Flow Modal */}
      {showReviewFlow && unreviewedSelection && (
        <ReviewFlow
          billId={billId}
          shareToken={shareToken}
          selectionId={unreviewedSelection.selectionId}
          restaurantName={restaurantName || 'das Restaurant'}
          googlePlaceId={googlePlaceId}
          onComplete={handleReviewComplete}
          onSkip={handleReviewSkip}
        />
      )}
    </>
  )
}
