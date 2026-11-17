import { IMAGE_SCHEME } from '../../../shared/types'

/** Side of a stored sound image: twice the largest Stream Deck key (96px on the XL). */
const KEY_IMAGE_SIZE = 192

/** Where the renderer loads a `Sound.image` from. */
export function soundImageUrl(name: string): string {
  return `${IMAGE_SCHEME}://sound/${encodeURIComponent(name)}`
}

/**
 * Turns any image Chromium can decode into the square PNG kept for a sound. The picture is
 * centre-cropped to fill the square: keys are square, and letterboxing a photo wastes most of one.
 * Rejects when the bytes aren't a readable image.
 */
export async function toKeyImage(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(new Blob([bytes]))
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = KEY_IMAGE_SIZE
  canvas.height = KEY_IMAGE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    KEY_IMAGE_SIZE,
    KEY_IMAGE_SIZE
  )
  bitmap.close()
  // toDataURL, not toBlob/convertToBlob: those wait for the page to go idle and give up waiting
  // only after a full second, which is how long the picture then takes to appear.
  const binary = atob(canvas.toDataURL('image/png').split(',')[1])
  const png = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) png[i] = binary.charCodeAt(i)
  return png.buffer
}
