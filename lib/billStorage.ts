/**
 * LocalStorage utility for persisting bill history
 */

export interface SavedBill {
  id: string
  shareToken: string
  createdAt: string
  payerName: string
  restaurantName: string | null
  totalAmount: number
  paidAmount: number
  lastViewed: string
}

const STORAGE_KEY = 'billHistory'

/**
 * Get all saved bills from localStorage
 */
export function getAllBills(): SavedBill[] {
  if (typeof window === 'undefined') return []

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []

    const bills = JSON.parse(data) as SavedBill[]
    return bills.sort((a, b) => new Date(b.lastViewed).getTime() - new Date(a.lastViewed).getTime())
  } catch (error) {
    console.error('Error loading bills from localStorage:', error)
    return []
  }
}

/**
 * Save or update a bill in localStorage
 */
export function saveBill(bill: SavedBill): void {
  if (typeof window === 'undefined') return

  try {
    const bills = getAllBills()
    const existingIndex = bills.findIndex(b => b.id === bill.id)

    if (existingIndex >= 0) {
      bills[existingIndex] = { ...bill, lastViewed: new Date().toISOString() }
    } else {
      bills.push({ ...bill, lastViewed: new Date().toISOString() })
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills))
  } catch (error) {
    console.error('Error saving bill to localStorage:', error)
  }
}

/**
 * Delete a bill from localStorage
 */
export function deleteBill(billId: string): void {
  if (typeof window === 'undefined') return

  try {
    const bills = getAllBills()
    const filtered = bills.filter(b => b.id !== billId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting bill from localStorage:', error)
  }
}

/**
 * Get a single bill by ID
 */
export function getBillById(billId: string): SavedBill | null {
  const bills = getAllBills()
  return bills.find(b => b.id === billId) || null
}
