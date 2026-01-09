/**
 * LocalStorage utility for persisting guest selections
 */

export interface SavedSelection {
  selectionId: string
  billId: string
  shareToken: string
  friendName: string
  itemQuantities: Record<string, number>
  subtotal: number
  tipAmount: number
  totalAmount: number
  paymentMethod: 'PAYPAL' | 'CASH'
  createdAt: string
  reviewed?: boolean // Has guest reviewed this selection?
}

const STORAGE_KEY = 'guestSelections'

/**
 * Get all saved selections from localStorage
 */
export function getAllSelections(): SavedSelection[] {
  if (typeof window === 'undefined') return []

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []

    const selections = JSON.parse(data) as SavedSelection[]
    return selections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error('Error loading selections from localStorage:', error)
    return []
  }
}

/**
 * Get all selections for a specific bill by shareToken
 */
export function getSelectionsByToken(shareToken: string): SavedSelection[] {
  const selections = getAllSelections()
  return selections
    .filter(s => s.shareToken === shareToken)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Save a selection to localStorage
 */
export function saveSelection(selection: SavedSelection): void {
  if (typeof window === 'undefined') return

  try {
    const selections = getAllSelections()

    // Add new selection (allow multiple selections per bill)
    selections.push({ ...selection, createdAt: new Date().toISOString() })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(selections))

    // Dispatch custom event to notify same-tab listeners
    window.dispatchEvent(new Event('selectionSaved'))
  } catch (error) {
    console.error('Error saving selection to localStorage:', error)
  }
}

/**
 * Delete a specific selection from localStorage by selectionId
 */
export function deleteSelection(selectionId: string): void {
  if (typeof window === 'undefined') return

  try {
    const selections = getAllSelections()
    const filtered = selections.filter(s => s.selectionId !== selectionId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting selection from localStorage:', error)
  }
}

/**
 * Delete all selections for a specific bill by shareToken
 */
export function deleteAllSelectionsForToken(shareToken: string): void {
  if (typeof window === 'undefined') return

  try {
    const selections = getAllSelections()
    const filtered = selections.filter(s => s.shareToken !== shareToken)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting selections from localStorage:', error)
  }
}

/**
 * Clear all selections from localStorage
 */
export function clearAllSelections(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing selections from localStorage:', error)
  }
}

/**
 * Mark a specific selection as reviewed by selectionId
 */
export function markSelectionAsReviewed(selectionId: string): void {
  if (typeof window === 'undefined') return

  try {
    const selections = getAllSelections()
    const updated = selections.map((s) =>
      s.selectionId === selectionId ? { ...s, reviewed: true } : s
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    // Dispatch custom event to notify listeners
    window.dispatchEvent(new Event('selectionReviewed'))
  } catch (error) {
    console.error('Error marking selection as reviewed:', error)
  }
}

/**
 * Check if there are unreviewed selections for a specific bill
 * Returns the first unreviewed selection, or null if all reviewed
 */
export function getFirstUnreviewedSelection(shareToken: string): SavedSelection | null {
  const selections = getSelectionsByToken(shareToken)

  // Return the first selection that hasn't been reviewed
  return selections.find((s) => !s.reviewed) || null
}

/**
 * Check if there are any unreviewed selections for a specific bill
 */
export function hasUnreviewedSelections(shareToken: string): boolean {
  return getFirstUnreviewedSelection(shareToken) !== null
}
