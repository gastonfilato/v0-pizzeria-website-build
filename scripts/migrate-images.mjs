import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { optimizeImage } from '../lib/optimize-image.mjs'

// Dry-run by default. Only --apply writes to Supabase.
const args = process.argv.slice(2)
const sourceIndex = args.indexOf('--sources')
if (sourceIndex < 0 || !args[sourceIndex + 1]) {
  throw new Error('Uso: node scripts/migrate-images.mjs --sources /carpeta/originales [--apply]')
}
const source = resolve(args[sourceIndex + 1])
const manifest = JSON.parse(await readFile(new URL('./totore-image-manifest.json', import.meta.url), 'utf8'))
const prepared = []
const missing = []
for (const row of manifest) {
  if (!['products', 'banners'].includes(row.table) ||
      row.column !== (row.table === 'products' ? 'image' : 'image_url') ||
      basename(row.file) !== row.file) throw new Error('Manifest inválido')
  let original
  try { original = await readFile(resolve(source, row.file)) } catch { missing.push(`${row.label}: ${row.file}`); continue }
  const image = await optimizeImage(original, row.table)
  prepared.push({ ...row, image, originalBytes: original.length })
}
if (missing.length) {
  console.error(`Faltan ${missing.length} originales. No se cambió ninguna imagen.\n${missing.join('\n')}`)
  process.exitCode = 1
} else {
  const originalBytes = prepared.reduce((sum, row) => sum + row.originalBytes, 0)
  const compressedBytes = prepared.reduce((sum, row) => sum + row.image.length, 0)
  console.log(JSON.stringify({ images: prepared.length, originalBytes, compressedBytes, apply: args.includes('--apply') }))
  if (args.includes('--apply')) await migrate()
}

async function migrate() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || new URL(url).hostname !== 'pjuxolgpjejlapzsejrf.supabase.co' || !key) {
    throw new Error('Se requieren las variables de Supabase de TOTORE. No se modificó la base.')
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: bucket, error: bucketError } = await client.storage.getBucket('media')
  if (bucketError || !bucket?.public) throw new Error('El bucket media debe existir y ser público.')
  // Verify every mapping before uploading or replacing any reference.
  for (const row of prepared) {
    const { data, error } = await client.from(row.table).select(row.column).eq('id', row.id).single()
    if (error || data[row.column] !== row.oldUrl) throw new Error(`Cambió la imagen de ${row.label}. Revisar el manifest.`)
  }
  const run = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = prepared.map(({ image, originalBytes, ...row }) => ({ ...row,
    newUrl: client.storage.from('media').getPublicUrl(`${row.table}/migration-${run}-${row.id}.webp`).data.publicUrl,
  }))
  await mkdir('.image-migration', { recursive: true })
  await writeFile(`.image-migration/${run}.json`, JSON.stringify(backup, null, 2), { flag: 'wx' })
  // Every new object must be readable before changing any database reference.
  for (let i = 0; i < prepared.length; i++) {
    const row = prepared[i]
    const path = `${row.table}/migration-${run}-${row.id}.webp`
    const { error } = await client.storage.from('media').upload(path, row.image, {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    })
    if (error) throw error
    const response = await fetch(backup[i].newUrl)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (!response.ok || !Buffer.from(bytes).equals(row.image)) throw new Error(`No se pudo verificar ${row.label}`)
  }
  const changed = []
  try {
    for (const row of backup) {
      const { data, error } = await client.from(row.table).update({ [row.column]: row.newUrl })
        .eq('id', row.id).eq(row.column, row.oldUrl).select('id')
      if (error || data?.length !== 1) throw new Error(`No se pudo actualizar ${row.label}`)
      changed.push(row)
    }
  } catch (error) {
    for (const row of changed.reverse()) {
      const { data, error: rollbackError } = await client.from(row.table).update({ [row.column]: row.oldUrl })
        .eq('id', row.id).eq(row.column, row.newUrl).select('id')
      if (rollbackError || data?.length !== 1) console.error(`Revisar restauración de ${row.label} con el respaldo ${run}.json`)
    }
    throw error
  }
  console.log(`Migradas y verificadas ${changed.length} imágenes. Respaldo: .image-migration/${run}.json`)
}
