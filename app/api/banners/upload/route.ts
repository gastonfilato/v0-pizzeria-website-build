import { type NextRequest } from 'next/server'
import { uploadImage } from '@/lib/upload-image'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return uploadImage(request, 'banners')
}
