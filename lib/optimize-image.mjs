import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** @param {Uint8Array} input @param {'products' | 'banners'} folder */
export async function optimizeImage(input, folder) {
  if (!input.byteLength || input.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('La imagen debe pesar entre 1 byte y 10 MB.')
  }
  const image = sharp(input, { limitInputPixels: 40_000_000 })
  const metadata = await image.metadata()
  if (!['jpeg', 'png', 'webp', 'gif', 'avif'].includes(metadata.format ?? '')) {
    throw new Error('Formato de imagen no permitido.')
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error('Usá una imagen sin animación.')
  }
  const maxDimension = folder === 'banners' ? 1920 : 1000
  return image.rotate().resize({
    width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true,
  }).webp({ quality: 78, effort: 4 }).toBuffer()
}
