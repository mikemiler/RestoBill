import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { getBaseUrl } from '@/lib/utils'
import { headers } from 'next/headers'
import Image from 'next/image'
import CollapsibleReceipt from '@/components/CollapsibleReceipt'
import BillAutoSave from '@/components/BillAutoSave'
import CopyButton from '@/components/CopyButton'
import QRCode from '@/components/QRCode'
import StatusPageClient from '@/components/StatusPageClient'
import WhatsAppShareButton from '@/components/WhatsAppShareButton'
import RestaurantFeedback from '@/components/RestaurantFeedback'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BillStatusPage({
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

  // NOTE: We no longer fetch selections server-side!
  // SelectionManager (client component) will fetch and manage selections via Realtime
  // This prevents stale data and race conditions

  // Calculate initial remaining quantities (will be recalculated client-side)
  const itemRemainingQuantities: Record<string, number> = {}
  bill.BillItem?.forEach((item: any) => {
    itemRemainingQuantities[item.id] = item.quantity
  })

  // Sort items by name
  const sortedItems = bill.BillItem?.sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  ) || []

  const headersList = await headers()
  const baseUrl = getBaseUrl(headersList)
  const shareUrl = `${baseUrl}/split/${bill.shareToken}`

  // Calculate total for BillAutoSave
  const totalBillAmount = sortedItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0)

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
          paidAmount: 0,
          lastViewed: new Date().toISOString(),
        }}
      />
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800 p-3 sm:p-4 md:p-8 pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-4 md:mb-6">
            <div className="mb-2 md:mb-3 flex justify-center">
              <Image
                src="/logo.png"
                alt="WerHatteWas Logo"
                width={50}
                height={50}
                className="app-logo md:w-[60px] md:h-[60px]"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-1 md:mb-2">
              Deine Rechnung
            </h1>
            {bill.restaurantName && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                {bill.restaurantName}
              </p>
            )}
          </div>

          {/* Share Link */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6 mb-4 md:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
              Link teilen
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
              Teile diesen Link mit deinen Freunden, damit sie ihre Positionen auswählen können
            </p>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-xs sm:text-sm"
              />
              <CopyButton text={shareUrl} />
            </div>
            <div className="mb-4">
              <WhatsAppShareButton
                shareUrl={shareUrl}
                reviewUrl={bill.reviewUrl || undefined}
                restaurantName={bill.restaurantName || undefined}
              />
            </div>
            <div className="share-qr-section">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-center">
                Oder lasse deine Freunde den QR-Code scannen
              </p>
              <div className="share-qr-wrapper">
                <QRCode value={shareUrl} size={180} />
              </div>
            </div>
          </div>

          {/* Receipt Image - Collapsible */}
          <div className="mb-4 md:mb-6">
            <CollapsibleReceipt
              imageUrl={bill.imageUrl}
              restaurantName={bill.restaurantName}
            />
          </div>

          {/* Client Components - Payment Overview, Guest List, Selection Form */}
          <StatusPageClient
            billId={bill.id}
            shareToken={bill.shareToken}
            payerName={bill.payerName}
            paypalHandle={bill.paypalHandle}
            items={sortedItems}
            itemRemainingQuantities={itemRemainingQuantities}
            totalBillAmount={totalBillAmount}
          />

          {/* Restaurant Feedback */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-4 sm:p-5 md:p-6 mt-4 md:mt-6">
            <RestaurantFeedback
              billId={bill.id}
              reviewUrl={bill.reviewUrl}
              restaurantName={bill.restaurantName}
            />
          </div>
        </div>
      </div>
    </>
  )
}
