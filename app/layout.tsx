import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solhem Digital Assets',
  description: 'Digital Asset Manager for Solhem Properties',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="app">
        <header className="app-header">
          <div className="header-content">
            <Link href="/">
              <h1>Solhem Digital Assets</h1>
            </Link>
            <nav className="header-nav">
              <Link href="/events" className="nav-link">
                Party Archive
              </Link>
              <Link href="/photos" className="nav-link">
                Photo Gallery
              </Link>
            </nav>
          </div>
        </header>
        <main className="app-main">
          {children}
        </main>
      </body>
    </html>
  )
}