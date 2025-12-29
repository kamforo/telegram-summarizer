import { NextResponse } from 'next/server'
import { clearAuthenticated } from '@/lib/auth'

export async function POST() {
  await clearAuthenticated()
  return NextResponse.json({ success: true })
}
