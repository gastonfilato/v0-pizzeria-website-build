import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeImage, MAX_IMAGE_BYTES } from './optimize-image.mjs'

test('resizes large photos and encodes smaller WebP without changing aspect ratio', async () => {
  const original = await sharp({ create: { width: 4000, height: 2000, channels: 3, background: '#e95824' } }).jpeg().toBuffer()
  for (const [folder, width] of [['products', 1000], ['banners', 1920]]) {
    const output = await optimizeImage(original, folder)
    const info = await sharp(output).metadata()
    assert.equal(info.format, 'webp')
    assert.equal(info.width, width)
    assert.equal(info.height, width / 2)
    assert.ok(output.length < original.length)
  }
})

test('applies EXIF orientation and does not enlarge small photos', async () => {
  const original = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#e95824' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const info = await sharp(await optimizeImage(original, 'products')).metadata()
  assert.equal(info.width, 50)
  assert.equal(info.height, 100)
})

test('rejects empty, oversized, corrupt and vector files', async () => {
  for (const input of [Buffer.alloc(0), Buffer.alloc(MAX_IMAGE_BYTES + 1), Buffer.from('not an image'), Buffer.from('<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"></svg>')]) {
    await assert.rejects(optimizeImage(input, 'products'))
  }
})
