import Link from 'next/link'

export default function Home() {
  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">
            Solhem Digital Assets
          </h1>
          <p className="homepage-subtitle">
            Party Photo Archive & Management System
          </p>
        </div>

        <div className="homepage-grid">
          {/* Party Archive Card */}
          <Link 
            href="/events"
            className="homepage-card"
          >
            <div className="homepage-card-content">
              <div className="homepage-card-icon blue">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="homepage-card-title blue">
                Party Archive
              </h2>
              <p className="homepage-card-description">
                Browse party photos organized by year and property. Access events from The Archive, The Fred, and Lucille properties.
              </p>
              <div className="homepage-card-action blue">
                <span>View Archive</span>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Photo Gallery Card */}
          <Link 
            href="/enhanced-gallery"
            className="homepage-card"
          >
            <div className="homepage-card-content">
              <div className="homepage-card-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="homepage-card-title green">
                Photo Gallery
              </h2>
              <p className="homepage-card-description">
                View all photos in a beautiful masonry layout with bulk selection, download, and advanced filtering capabilities.
              </p>
              <div className="homepage-card-action green">
                <span>Open Gallery</span>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="stats-section">
          <h3 className="stats-title">System Overview</h3>
          <div className="stats-grid">
            <div className="stats-item blue">
              <div className="stats-number blue">3</div>
              <div className="stats-label">Properties</div>
            </div>
            <div className="stats-item green">
              <div className="stats-number green">6</div>
              <div className="stats-label">Party Events</div>
            </div>
            <div className="stats-item purple">
              <div className="stats-number purple">1,735</div>
              <div className="stats-label">Total Photos</div>
            </div>
            <div className="stats-item orange">
              <div className="stats-number orange">Active</div>
              <div className="stats-label">Status</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="features-section">
          <h3 className="features-title">Platform Features</h3>
          <div className="features-grid">
            {[
              { icon: "📅", title: "Year-Based Organization", desc: "Photos organized by event year" },
              { icon: "🏢", title: "Multi-Property Support", desc: "Manage multiple properties" },
              { icon: "⬇️", title: "Bulk Downloads", desc: "Download multiple photos as ZIP" },
              { icon: "⭐", title: "Top Picks", desc: "Curated best photos per event" },
              { icon: "🖼️", title: "Lightbox View", desc: "Full-screen photo viewing" },
              { icon: "📊", title: "EXIF Data", desc: "Camera metadata extraction" }
            ].map((feature, idx) => (
              <div key={idx} className="feature-item">
                <div className="feature-emoji">{feature.icon}</div>
                <h4 className="feature-title">{feature.title}</h4>
                <p className="feature-description">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}