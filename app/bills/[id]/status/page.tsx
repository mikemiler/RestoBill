import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatEUR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BillStatusPage({
  params,
}: {
  params: { id: string }
}) {
  const bill = await prisma.bill.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      selections: {
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!bill) {
    notFound()
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/split/${bill.shareToken}`

  // Calculate totals
  const totalBillAmount = bill.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const totalCollected = bill.selections.reduce((sum, selection) => {
    const selectionTotal = selection.items.reduce((itemSum, item) => {
      const quantities = selection.itemQuantities as Record<string, number>
      const quantity = quantities[item.id] || 0
      return itemSum + item.pricePerUnit * item.quantity * quantity
    }, 0)
    return sum + selectionTotal + selection.tipAmount
  }, 0)

  const totalPaid = bill.selections
    .filter((s) => s.paid)
    .reduce((sum, selection) => {
      const selectionTotal = selection.items.reduce((itemSum, item) => {
        const quantities = selection.itemQuantities as Record<string, number>
        const quantity = quantities[item.id] || 0
        return itemSum + item.pricePerUnit * item.quantity * quantity
      }, 0)
      return sum + selectionTotal + selection.tipAmount
    }, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Status Dashboard
          </h1>
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
              {bill.selections.length} {bill.selections.length === 1 ? 'Person' : 'Personen'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-sm text-gray-600 mb-2">Bezahlt</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatEUR(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {bill.selections.filter((s) => s.paid).length} von {bill.selections.length}
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
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Kopieren
            </button>
          </div>
        </div>

        {/* Selections List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Zahlungen ({bill.selections.length})
          </h2>

          {bill.selections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Noch keine Auswahl getroffen</p>
              <p className="text-sm mt-2">Teile den Link mit deinen Freunden!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bill.selections.map((selection) => {
                const quantities = selection.itemQuantities as Record<string, number>
                const selectionTotal = selection.items.reduce((sum, item) => {
                  const quantity = quantities[item.id] || 0
                  return sum + item.pricePerUnit * item.quantity * quantity
                }, 0)
                const total = selectionTotal + selection.tipAmount

                return (
                  <div
                    key={selection.id}
                    className={`border rounded-lg p-4 ${
                      selection.paid
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {selection.friendName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(selection.createdAt).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {formatEUR(total)}
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            selection.paid
                              ? 'bg-green-200 text-green-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {selection.paid ? '✓ Bezahlt' : 'Ausstehend'}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm space-y-1">
                      {selection.items.map((item) => {
                        const quantity = quantities[item.id] || 0
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between text-gray-700"
                          >
                            <span>
                              {item.name} ({quantity}x)
                            </span>
                            <span>
                              {formatEUR(item.pricePerUnit * item.quantity * quantity)}
                            </span>
                          </div>
                        )
                      })}
                      {selection.tipAmount > 0 && (
                        <div className="flex justify-between text-gray-700 font-medium">
                          <span>Trinkgeld</span>
                          <span>{formatEUR(selection.tipAmount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
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
