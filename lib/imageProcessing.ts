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

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Failed to read file'))

    reader.onload = (e) => {
      const img = new Image()

      img.onerror = () => reject(new Error('Failed to load image'))

      img.onload = () => {
        // Calculate new dimensions (maintain aspect ratio)
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Draw image with high quality settings
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }

            // Create new File from blob
            const compressedFile = new File([blob], file.name, {
              type: format,
              lastModified: Date.now(),
            })

            resolve(compressedFile)
          },
          format,
          quality
        )
      }

      img.src = e.target?.result as string
    }

    reader.readAsDataURL(file)
  })
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
