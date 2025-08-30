import { headers } from 'next/headers'

export function getOrigin(): string {
  // SSR-safe
  if (typeof window !== 'undefined') return window.location.origin
  try {
    const h = headers()
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:8888'
    return process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
  }
}

export function getClientOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}