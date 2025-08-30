// Client-safe version that works in both server and client contexts
export function getOrigin(): string {
  // Client-side: always reliable
  if (typeof window !== 'undefined') return window.location.origin

  // Server-side fallback (without headers import for client compatibility)
  const port = process.env.PORT ?? '8888' // Netlify CLI exposes PORT
  return process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${port}`
}

export function getClientOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  const port = process.env.PORT ?? '8888'
  return process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${port}`
}