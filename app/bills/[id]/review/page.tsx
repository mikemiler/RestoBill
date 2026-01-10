import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { formatEUR, getBaseUrl } from '@/lib/utils'
import { headers } from 'next/headers'
import Image from 'next/image'
import ShareLink from '@/components/ShareLink'

export default async function ReviewBillPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: bill } = await supabaseAdmin
    .from('Bill')
    .select('*, BillItem(*)')
    .eq('id', params.id)
    .single()

  if (!bill) {
    notFound()
  }

  const billItems = bill.BillItem || []
  const totalAmount = billItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
  const headersList = await headers()
  const baseUrl = getBaseUrl(headersList)
  const shareUrl = `${baseUrl}/split/${bill.shareToken}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            Rechnung überprüfen
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            KI hat deine Rechnung analysiert. Überprüfe die Positionen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Left: Image */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Hochgeladene Rechnung
            </h2>
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={bill.imageUrl}
                alt="Rechnung"
                fill
                className="object-contain rounded-lg"
              />
            </div>
            {bill.restaurantName && (
              <p className="mt-4 text-center text-gray-600 dark:text-gray-300 font-medium">
                📍 {bill.restaurantName}
              </p>
            )}
          </div>

          {/* Right: Items */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Extrahierte Positionen ({billItems.length})
            </h2>

            <div className="space-y-3 mb-6">
              {billItems.map((item: any) => (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors dark:bg-gray-700/50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{item.name}</h3>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {formatEUR(item.totalPrice)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {item.quantity}x à {formatEUR(item.pricePerUnit)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t dark:border-gray-600 pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="dark:text-gray-100">Gesamt:</span>
                <span className="text-blue-600 dark:text-blue-400">{formatEUR(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Share Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100 text-center">
            Link teilen
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Teile diesen Link mit deinen Freunden, damit sie ihre Positionen auswählen können
          </p>

          <ShareLink shareUrl={shareUrl} />

          <div className="mt-8 grid grid-cols-2 gap-4">
            <a
              href={`/bills/${bill.id}/status`}
              className="inline-block text-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Status ansehen
            </a>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Vorschau öffnen
            </a>
          </div>
        </div>

        <div className="mt-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">
            ✅ Was passiert jetzt?
          </h3>
          <ol className="text-sm text-green-800 dark:text-green-300 space-y-1">
            <li>1. Teile den Link mit deinen Freunden</li>
            <li>2. Jeder wählt seine Positionen aus und gibt Trinkgeld</li>
            <li>3. Per Klick werden sie zu PayPal geleitet</li>
            <li>4. Du siehst im Status-Dashboard wer bezahlt hat</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
