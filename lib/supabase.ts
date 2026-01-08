import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Database Types (matching Prisma schema)
export interface Bill {
  id: string
  createdAt: string
  payerName: string
  paypalHandle: string
  imageUrl: string
  restaurantName: string | null
  totalAmount: number | null
  shareToken: string
}

export interface BillItem {
  id: string
  billId: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

export interface Selection {
  id: string
  billId: string
  friendName: string
  itemQuantities: Record<string, number> | null
  tipAmount: number
  paid: boolean
  paidAt: string | null
  createdAt: string
}

// Server-side Supabase client with service role for storage uploads
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Client-side Supabase client (for public access)
export const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Upload bill image to Supabase Storage
 * @param billId - The bill ID to use as filename
 * @param file - The image file
 * @returns Public URL of uploaded image
 */
export async function uploadBillImage(
  billId: string,
  file: File
): Promise<string> {
  // Sanitize file extension to prevent path traversal
  const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!fileExt || !['jpg', 'jpeg', 'png', 'heic'].includes(fileExt)) {
    throw new Error('Ungültiges Dateiformat. Nur JPG, PNG und HEIC sind erlaubt.')
  }

  // Validate and sanitize billId (should be UUID)
  if (!/^[a-f0-9-]{36}$/i.test(billId)) {
    throw new Error('Ungültige Bill ID')
  }

  const fileName = `${billId}.${fileExt}`
  const filePath = `bills/${fileName}`

  const { error } = await supabaseAdmin.storage
    .from('bill-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  // Get public URL
  const { data } = supabaseAdmin.storage
    .from('bill-images')
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Get public URL for a bill image
 * @param billId - The bill ID
 * @param extension - File extension (default: jpg)
 * @returns Public URL
 */
export function getBillImageUrl(billId: string, extension = 'jpg'): string {
  const filePath = `bills/${billId}.${extension}`
  const { data } = supabaseAdmin.storage
    .from('bill-images')
    .getPublicUrl(filePath)

  return data.publicUrl
}
