import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import SplitFormContainer from '@/components/SplitFormContainer'
import CollapsibleReceipt from '@/components/CollapsibleReceipt'

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

  // Fetch all selections for this bill to calculate remaining quantities
  const { data: selections } = await supabaseAdmin
    .from('Selection')
    .select('itemQuantities')
    .eq('billId', bill.id)

  // Calculate remaining quantities for each item
  const itemRemainingQuantities: Record<string, number> = {}

  bill.BillItem?.forEach((item: any) => {
    let totalClaimed = 0

    selections?.forEach((selection) => {
      const itemQuantities = selection.itemQuantities as Record<string, number> | null
      if (itemQuantities && itemQuantities[item.id]) {
        totalClaimed += itemQuantities[item.id]
      }
    })

    itemRemainingQuantities[item.id] = Math.max(0, item.quantity - totalClaimed)
  })

  // Sort items by name
  const sortedItems = bill.BillItem?.sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  ) || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800 p-3 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4 md:mb-6">
          <div className="mb-2 md:mb-3 flex justify-center">
            <Image
              src="/logo.png"
              alt="Kill The Bill Logo"
              width={50}
              height={50}
              className="app-logo md:w-[60px] md:h-[60px]"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-1 md:mb-2">
            Rechnung teilen
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Von {bill.payerName}
            {bill.restaurantName && ` • ${bill.restaurantName}`}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 md:mb-8">
          {/* Left: Receipt Image - Collapsible on mobile */}
          <div className="md:hidden">
            <CollapsibleReceipt imageUrl={bill.imageUrl} />
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6">
            <SplitFormContainer
              billId={bill.id}
              shareToken={params.token}
              payerName={bill.payerName}
              paypalHandle={bill.paypalHandle}
              items={sortedItems}
              itemRemainingQuantities={itemRemainingQuantities}
              restaurantName={bill.restaurantName}
              googlePlaceId={bill.googlePlaceId}
            />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm sm:text-base">
            ℹ️ So funktioniert&apos;s
          </h3>
          <ol className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 space-y-1">
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
