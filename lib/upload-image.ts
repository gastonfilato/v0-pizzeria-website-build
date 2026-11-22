import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_IMAGE_BYTES, optimizeImage } from '@/lib/optimize-image.mjs'

export async function uploadImage(request: NextRequest, folder: 'products' | 'banners') {
  try {
    const session = await createClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Iniciá sesión para subir imágenes.' }, { status: 401 })
    }
    const { data: admin, error: adminError } = await session
      .from('admin_users').select('id').eq('id', user.id).maybeSingle()
    if (adminError || !admin) {
      return NextResponse.json({ error: 'No tenés permiso para subir imágenes.' }, { status: 403 })
    }
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Seleccioná una imagen de hasta 10 MB.' }, { status: 400 })
    }
    let compressed: Buffer
    try {
      compressed = await optimizeImage(new Uint8Array(await file.arrayBuffer()), folder)
    } catch {
      return NextResponse.json({ error: 'La imagen no es válida. Usá JPG, PNG, WEBP, AVIF o GIF sin animación.' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const path = `${folder}/${randomUUID()}.webp`
    const { error } = await supabase.storage.from('media').upload(path, compressed, {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('[image-upload]', error)
    return NextResponse.json({ error: 'No se pudo guardar la imagen. Intentá nuevamente.' }, { status: 500 })
  }
}
