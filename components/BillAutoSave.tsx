'use client'

import { useEffect } from 'react'
import { saveBill, type SavedBill } from '@/lib/billStorage'

interface BillAutoSaveProps {
  bill: SavedBill
}

export default function BillAutoSave({ bill }: BillAutoSaveProps) {
  useEffect(() => {
    saveBill(bill)
  }, [bill])

  return null
}
