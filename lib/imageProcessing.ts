/**
 * Client-side image processing utilities
 * Used to compress images before uploading to Vercel (4.5MB body limit)
 */

export interface ResizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'image/jpeg' | 'image/webp' | 'image/png'
}

/**
 * Resize and compress image file client-side using Canvas API
 * @param file - Image file to process
 * @param options - Resize options (defaults: 2000px max, 85% quality, JPEG)
 * @returns Compressed image as File object
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions = {}
): Promise<File> {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 0.85,
    format = 'image/jpeg',
  } = options

  console.log('[resizeImage] Start:', {
    originalFile: file.name,
    originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    originalType: file.type,
    targetFormat: format,
    quality,
  })

  // Wrap in timeout promise
  const resizePromise = new Promise<File>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => {
      console.error('[resizeImage] FileReader error')
      reject(new Error('Failed to read file'))
    }

    reader.onload = (e) => {
      console.log('[resizeImage] File loaded into memory')
      const img = new Image()

      img.onerror = () => {
        console.error('[resizeImage] Image load error')
        reject(new Error('Failed to load image'))
      }

      img.onload = () => {
        console.log('[resizeImage] Image dimensions:', {
          original: `${img.width}x${img.height}`,
        })

        // Calculate new dimensions (maintain aspect ratio)
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
          console.log('[resizeImage] Resizing to:', `${width}x${height}`, `(ratio: ${ratio.toFixed(2)})`)
        } else {
          console.log('[resizeImage] No resize needed (image smaller than max)')
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.error('[resizeImage] Canvas context error')
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Draw image with high quality settings
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        console.log('[resizeImage] Canvas drawn, converting to blob...')

        // Convert canvas to blob (with fallback for older browsers)
        if (canvas.toBlob) {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                console.error('[resizeImage] Blob creation failed, trying fallback...')
                // Fallback: Use toDataURL
                try {
                  const dataUrl = canvas.toDataURL(format, quality)
                  const base64Data = dataUrl.split(',')[1]
                  const binaryString = atob(base64Data)
                  const bytes = new Uint8Array(binaryString.length)
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                  }
                  const fallbackBlob = new Blob([bytes], { type: format })
                  const compressedFile = new File([fallbackBlob], file.name, {
                    type: format,
                    lastModified: Date.now(),
                  })
                  console.log('[resizeImage] ✅ Fallback successful!', `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
                  resolve(compressedFile)
                } catch (fallbackError) {
                  console.error('[resizeImage] Fallback also failed:', fallbackError)
                  reject(new Error('Bild-Konvertierung fehlgeschlagen. Bitte verwende ein anderes Bild.'))
                }
                return
              }

              console.log('[resizeImage] Blob created:', `${(blob.size / 1024 / 1024).toFixed(2)}MB`)

              // Create new File from blob
              const compressedFile = new File([blob], file.name, {
                type: format,
                lastModified: Date.now(),
              })

              const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1)
              console.log('[resizeImage] ✅ Success!', {
                finalSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
                reduction: `${compressionRatio}%`,
              })

              resolve(compressedFile)
            },
            format,
            quality
          )
        } else {
          // Fallback for browsers without toBlob support
          console.warn('[resizeImage] canvas.toBlob not supported, using fallback')
          try {
            const dataUrl = canvas.toDataURL(format, quality)
            const base64Data = dataUrl.split(',')[1]
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const fallbackBlob = new Blob([bytes], { type: format })
            const compressedFile = new File([fallbackBlob], file.name, {
              type: format,
              lastModified: Date.now(),
            })
            console.log('[resizeImage] ✅ Fallback successful!', `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
            resolve(compressedFile)
          } catch (fallbackError) {
            console.error('[resizeImage] Fallback failed:', fallbackError)
            reject(new Error('Bild-Konvertierung fehlgeschlagen (kein Browser-Support).'))
          }
        }
      }

      img.src = e.target?.result as string
    }

    reader.readAsDataURL(file)
  })

  // Add 30-second timeout
  const timeoutPromise = new Promise<File>((_, reject) =>
    setTimeout(() => {
      console.error('[resizeImage] Timeout after 30s')
      reject(new Error('Bild-Komprimierung dauert zu lange (Timeout). Bitte verwende ein kleineres Bild.'))
    }, 30000)
  )

  // Race between resize and timeout
  return Promise.race([resizePromise, timeoutPromise])
}

/**
 * Calculate compressed file size estimate
 * @param file - Original file
 * @param width - Original width
 * @param height - Original height
 * @param newWidth - Target width
 * @param newHeight - Target height
 * @param quality - JPEG quality (0-1)
 * @returns Estimated size in bytes
 */
export function estimateCompressedSize(
  file: File,
  width: number,
  height: number,
  newWidth: number,
  newHeight: number,
  quality: number
): number {
  const pixelRatio = (newWidth * newHeight) / (width * height)
  const qualityFactor = quality
  return Math.round(file.size * pixelRatio * qualityFactor)
}
