import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import SplitForm from '@/components/SplitForm'

export default async function SplitBillPage({
  params,
}: {
  params: { token: string }
}) {
  const { data: bill } = await supabaseAdmin
    .from('Bill')
    .select('*, BillItem(*)')
    .eq('shareToken', params.token)
    .single()

  if (!bill) {
    notFound()
  }

  // Sort items by name
  const sortedItems = bill.BillItem?.sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  ) || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            🍽️ Rechnung teilen
          </h1>
          <p className="text-gray-600">
            Von {bill.payerName}
            {bill.restaurantName && ` • ${bill.restaurantName}`}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Left: Receipt Image */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">
              📸 Rechnung
            </h2>
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={bill.imageUrl}
                alt="Rechnung"
                fill
                className="object-contain rounded-lg"
              />
            </div>
          </div>

          {/* Right: Selection Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <SplitForm
              billId={bill.id}
              shareToken={params.token}
              payerName={bill.payerName}
              paypalHandle={bill.paypalHandle}
              items={sortedItems}
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            ℹ️ So funktioniert&apos;s
          </h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Gib deinen Namen ein</li>
            <li>2. Wähle deine Positionen aus (du kannst auch halbe Portionen wählen)</li>
            <li>3. Füge optional Trinkgeld hinzu</li>
            <li>4. Klicke auf &quot;Jetzt bezahlen&quot; - du wirst zu PayPal weitergeleitet</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
