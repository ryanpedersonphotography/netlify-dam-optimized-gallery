import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Handle API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Let Next.js handle all other routes
  return NextResponse.next()
}

export const config = {
  matcher: [
    // exclude Next internals, static, Netlify Images, and the serve endpoint
    '/((?!_next/|static/|\\.netlify/images|api/asset-handler/serve|favicon.ico|robots.txt|sitemap\\.xml).*)',
  ],
}