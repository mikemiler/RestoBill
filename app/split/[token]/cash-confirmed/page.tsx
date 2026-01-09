import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import CashConfirmedContent from '@/components/CashConfirmedContent'

export default async function CashConfirmedPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { selectionId?: string; total?: string }
}) {
  const { selectionId, total } = searchParams

  if (!selectionId) {
    notFound()
  }

  // Fetch selection to verify and get bill details
  const { data: selection } = await supabaseAdmin
    .from('Selection')
    .select('*, bill:Bill(*)')
    .eq('id', selectionId)
    .single()

  if (!selection || selection.bill?.shareToken !== params.token) {
    notFound()
  }

  const totalAmount = total ? parseFloat(total) : 0

  return (
    <CashConfirmedContent
      selectionId={selectionId}
      shareToken={params.token}
      billId={selection.bill.id}
      payerName={selection.bill.payerName}
      restaurantName={selection.bill.restaurantName}
      googlePlaceId={selection.bill.googlePlaceId}
      totalAmount={totalAmount}
    />
  )
}
