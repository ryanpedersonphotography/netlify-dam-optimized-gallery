// Client-safe version that works in both server and client contexts
export function getOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  // Fallback for SSR
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}

export function getClientOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  // Fallback for SSR - uses public env var
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}