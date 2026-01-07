import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
  const fileExt = file.name.split('.').pop()
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
