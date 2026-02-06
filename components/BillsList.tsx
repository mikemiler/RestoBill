'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAllBills, deleteBill, type SavedBill } from '@/lib/billStorage'
import { formatEUR } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

export default function BillsList() {
  const [bills, setBills] = useState<SavedBill[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { t, language } = useTranslation()

  useEffect(() => {
    setBills(getAllBills())
  }, [])

  const handleDelete = (billId: string) => {
    deleteBill(billId)
    setBills(getAllBills())
    setDeleteConfirmId(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const localeMap: Record<string, string> = {
      de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT'
    }
    return new Intl.DateTimeFormat(localeMap[language] || 'de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (bills.length === 0) {
    return null
  }

  return (
    <div className="bills-history">
      <h2>{t.billsList.savedBills}</h2>
      <div className="bills-list">
        {bills.map((bill) => (
          <div key={bill.id} className="bill-card">
            <Link href={`/bills/${bill.id}/status`} className="bill-link">
              <div className="bill-info">
                <div className="bill-header">
                  {bill.restaurantName && (
                    <h3>{bill.restaurantName}</h3>
                  )}
                  <p className="bill-date">{formatDate(bill.createdAt)}</p>
                </div>
                <div className="bill-amounts">
                  <div className="amount-row">
                    <span className="amount-label">{t.billsList.total}</span>
                    <span className="amount-value">{formatEUR(bill.totalAmount)}</span>
                  </div>
                  <div className="amount-row">
                    <span className="amount-label">{t.billsList.paid}</span>
                    <span className="amount-value paid">{formatEUR(bill.paidAmount)}</span>
                  </div>
                  {bill.paidAmount < bill.totalAmount && (
                    <div className="amount-row outstanding">
                      <span className="amount-label">{t.billsList.outstanding}</span>
                      <span className="amount-value">{formatEUR(bill.totalAmount - bill.paidAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault()
                setDeleteConfirmId(bill.id)
              }}
              className="delete-btn"
              aria-label={t.billsList.deleteBillLabel}
            >
              ×
            </button>
            {deleteConfirmId === bill.id && (
              <div className="delete-confirm">
                <p>{t.billsList.deleteConfirm}</p>
                <div className="delete-confirm-buttons">
                  <button
                    onClick={() => handleDelete(bill.id)}
                    className="confirm-yes"
                  >
                    {t.common.yes}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="confirm-no"
                  >
                    {t.common.no}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
