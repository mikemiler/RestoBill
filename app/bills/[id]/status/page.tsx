import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { formatEUR } from '@/lib/utils'
import CopyButton from '@/components/CopyButton'
import SelectionCard from '@/components/SelectionCard'
import RefreshButton from '@/components/RefreshButton'

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

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/split/${bill.shareToken}`

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Status Dashboard
            </h1>
            <RefreshButton />
          </div>
          <p className="text-gray-600">
            Übersicht deiner Rechnung
            {bill.restaurantName && ` von ${bill.restaurantName}`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-sm text-gray-600 mb-2">Rechnungssumme</h3>
            <p className="text-2xl font-bold text-gray-900">
              {formatEUR(totalBillAmount)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-sm text-gray-600 mb-2">Ausgewählt</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatEUR(totalCollected)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {selections.length} {selections.length === 1 ? 'Person' : 'Personen'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-sm text-gray-600 mb-2">Bezahlt</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatEUR(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {selections.filter((s: any) => s.paid).length} von {selections.length}
            </p>
          </div>
        </div>

        {/* Share Link */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            Share Link
          </h2>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <CopyButton text={shareUrl} />
          </div>
        </div>

        {/* Selections List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Zahlungen ({selections.length})
          </h2>

          {selections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Noch keine Auswahl getroffen</p>
              <p className="text-sm mt-2">Teile den Link mit deinen Freunden!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selections.map((selection: any) => {
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
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <a
            href={`/bills/${bill.id}/review`}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Zurück zur Übersicht
          </a>
        </div>
      </div>
    </div>
  )
}
