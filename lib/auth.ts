import { cookies } from 'next/headers'

const AUTH_COOKIE = 'telegram-summarizer-auth'

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE)
  return authCookie?.value === 'authenticated'
}

export async function setAuthenticated(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearAuthenticated(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE)
}

export function validatePassword(password: string): boolean {
  const correctPassword = process.env.DASHBOARD_PASSWORD
  if (!correctPassword) {
    console.warn('DASHBOARD_PASSWORD not set in environment variables')
    return false
  }
  return password === correctPassword
}
