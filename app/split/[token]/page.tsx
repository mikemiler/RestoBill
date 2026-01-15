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

  // Calculate total amount from items (consistent with status page)
  const totalBillAmount = sortedItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0)

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

        {/* Receipt Image - Collapsible */}
        <div className="mb-4 md:mb-6">
          <CollapsibleReceipt
            imageUrl={bill.imageUrl}
            restaurantName={bill.restaurantName}
          />
        </div>

        {/* Selection Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6 mb-4 md:mb-8">
          <SplitFormContainer
            billId={bill.id}
            shareToken={params.token}
            payerName={bill.payerName}
            paypalHandle={bill.paypalHandle}
            items={sortedItems}
            itemRemainingQuantities={itemRemainingQuantities}
            totalAmount={totalBillAmount}
          />
        </div>
      </div>
    </div>
  )
}
