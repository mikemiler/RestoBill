import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { formatEUR, getBaseUrl } from '@/lib/utils'
import { headers } from 'next/headers'
import CopyButton from '@/components/CopyButton'
import SelectionCard from '@/components/SelectionCard'
import RefreshButton from '@/components/RefreshButton'
import BillItemsEditor from '@/components/BillItemsEditor'
import BillAutoSave from '@/components/BillAutoSave'
import CollapsibleReceipt from '@/components/CollapsibleReceipt'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BillStatusPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: bill } = await supabaseAdmin
    .from('Bill')
    .select('*, BillItem(*), Selection(*)')
    .eq('id', params.id)
    .single()

  if (!bill) {
    notFound()
  }

  // Get all items for the bill to use in selections
  const billItems = bill.BillItem || []
  const selections = (bill.Selection || []).sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Find owner selection
  const ownerSelection = selections.find((s: any) => s.friendName === bill.payerName)
  const guestSelections = selections.filter((s: any) => s.friendName !== bill.payerName)

  const headersList = await headers()
  const baseUrl = getBaseUrl(headersList)
  const shareUrl = `${baseUrl}/split/${bill.shareToken}`

  // Calculate totals
  const totalBillAmount = billItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
  const totalCollected = selections.reduce((sum: number, selection: any) => {
    const quantities = selection.itemQuantities as Record<string, number> || {}
    const selectionTotal = Object.entries(quantities).reduce((itemSum, [itemId, quantity]) => {
      const item = billItems.find((i: any) => i.id === itemId)
      if (!item) return itemSum
      return itemSum + item.pricePerUnit * (quantity as number)
    }, 0)
    return sum + selectionTotal + (selection.tipAmount || 0)
  }, 0)

  const totalPaid = selections
    .filter((s: any) => s.paid)
    .reduce((sum: number, selection: any) => {
      const quantities = selection.itemQuantities as Record<string, number> || {}
      const selectionTotal = Object.entries(quantities).reduce((itemSum, [itemId, quantity]) => {
        const item = billItems.find((i: any) => i.id === itemId)
        if (!item) return itemSum
        return itemSum + item.pricePerUnit * (quantity as number)
      }, 0)
      return sum + selectionTotal + (selection.tipAmount || 0)
    }, 0)

  // Calculate unpaid items
  const itemStatus = billItems.map((item: any) => {
    const totalClaimed = selections.reduce((sum: number, selection: any) => {
      const quantities = selection.itemQuantities as Record<string, number> || {}
      return sum + (quantities[item.id] || 0)
    }, 0)

    const paidClaimed = selections
      .filter((s: any) => s.paid)
      .reduce((sum: number, selection: any) => {
        const quantities = selection.itemQuantities as Record<string, number> || {}
        return sum + (quantities[item.id] || 0)
      }, 0)

    return {
      ...item,
      totalClaimed,
      paidClaimed,
      unpaidQuantity: totalClaimed - paidClaimed,
      unclaimedQuantity: item.quantity - totalClaimed,
    }
  })

  return (
    <>
      <BillAutoSave
        bill={{
          id: bill.id,
          shareToken: bill.shareToken,
          createdAt: bill.createdAt,
          payerName: bill.payerName,
          restaurantName: bill.restaurantName,
          totalAmount: totalBillAmount,
          paidAmount: totalPaid,
          lastViewed: new Date().toISOString(),
        }}
      />
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Status Dashboard
            </h1>
            <RefreshButton />
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Übersicht deiner Rechnung
            {bill.restaurantName && ` von ${bill.restaurantName}`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Rechnungssumme</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatEUR(totalBillAmount)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Bezahlt</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatEUR(totalCollected)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selections.length} {selections.length === 1 ? 'Person' : 'Personen'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Zahlung bestätigt</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatEUR(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selections.filter((s: any) => s.paid).length} von {selections.length}
            </p>
          </div>
        </div>

        {/* Share Link */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Link teilen
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Teile diesen Link mit deinen Freunden, damit sie ihre Positionen auswählen können
          </p>
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm"
            />
            <CopyButton text={shareUrl} />
          </div>
          <div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Vorschau öffnen
            </a>
          </div>
        </div>

        {/* Selections List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Zahlungen ({selections.length})
          </h2>

          {selections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Noch keine Zahlungen</p>
              <p className="text-sm mt-2">Teile den Link mit deinen Freunden!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ownerSelection && (
                <>
                  {(() => {
                    const quantities = ownerSelection.itemQuantities as Record<string, number> || {}
                    const selectionTotal = Object.entries(quantities).reduce((sum, [itemId, quantity]) => {
                      const item = billItems.find((i: any) => i.id === itemId)
                      if (!item) return sum
                      return sum + item.pricePerUnit * (quantity as number)
                    }, 0)
                    const total = selectionTotal + (ownerSelection.tipAmount || 0)

                    return (
                      <SelectionCard
                        key={ownerSelection.id}
                        selection={ownerSelection}
                        billItems={billItems}
                        total={total}
                        isOwner={true}
                      />
                    )
                  })()}
                  {guestSelections.length > 0 && (
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-4">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                        Gäste ({guestSelections.length})
                      </h3>
                    </div>
                  )}
                </>
              )}
              {guestSelections.map((selection: any) => {
                const quantities = selection.itemQuantities as Record<string, number> || {}
                const selectionTotal = Object.entries(quantities).reduce((sum, [itemId, quantity]) => {
                  const item = billItems.find((i: any) => i.id === itemId)
                  if (!item) return sum
                  return sum + item.pricePerUnit * (quantity as number)
                }, 0)
                const total = selectionTotal + (selection.tipAmount || 0)

                return (
                  <SelectionCard
                    key={selection.id}
                    selection={selection}
                    billItems={billItems}
                    total={total}
                    isOwner={false}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Receipt Image */}
        <CollapsibleReceipt
          imageUrl={bill.imageUrl}
          restaurantName={bill.restaurantName}
        />

        {/* Bill Items Editor */}
        <div className="mb-8">
          <BillItemsEditor
            billId={bill.id}
            items={itemStatus}
            payerName={bill.payerName}
            ownerSelection={ownerSelection}
          />
        </div>
      </div>
    </div>
    </>
  )
}
