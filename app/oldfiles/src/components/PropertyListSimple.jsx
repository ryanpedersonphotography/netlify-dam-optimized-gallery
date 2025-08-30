import { Link } from 'react-router-dom'
import './PropertyList.css'

const PropertyListSimple = ({ properties, viewMode = 'parties' }) => {
  // For party view, only show properties with parties
  const propertiesWithParties = properties.filter(p => 
    p.events && p.events.parties && p.events.parties.length > 0
  )

  // Get total photo counts
  const totalPhotos = propertiesWithParties.reduce((acc, property) => {
    return acc + property.events.parties.reduce((sum, party) => {
      return sum + (party.assets?.all?.length || 0)
    }, 0)
  }, 0)

  const totalEvents = propertiesWithParties.reduce((acc, property) => {
    return acc + property.events.parties.length
  }, 0)

  return (
    <div className="property-list">
      <div className="hero-section">
        <h1>Solhem Party Photo Archive</h1>
        <p className="hero-subtitle">Professional event documentation for our residential communities</p>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-number">{propertiesWithParties.length}</span>
            <span className="stat-label">Properties</span>
          </div>
          <div className="stat">
            <span className="stat-number">{totalEvents}</span>
            <span className="stat-label">Events</span>
          </div>
          <div className="stat">
            <span className="stat-number">{totalPhotos.toLocaleString()}</span>
            <span className="stat-label">Photos</span>
          </div>
        </div>
      </div>

      <h2 className="section-title">Select a Property</h2>
      <div className="property-grid">
        {propertiesWithParties.map(property => {
          const latestParty = property.events.parties[property.events.parties.length - 1]
          const partyCount = property.events.parties.length
          const totalPropertyPhotos = property.events.parties.reduce((sum, party) => {
            return sum + (party.assets?.all?.length || 0)
          }, 0)
          const previewImage = latestParty.assets?.top?.[0] || latestParty.assets?.all?.[0]
          const isUpcoming = latestParty.upcoming === true
          
          return (
            <Link 
              key={property.id}
              to={isUpcoming ? '#' : `/event/${property.id}/${latestParty.year}`}
              className={`property-card enhanced ${isUpcoming ? 'upcoming' : ''}`}
              onClick={isUpcoming ? (e) => e.preventDefault() : undefined}
            >
              {previewImage ? (
                <div className="property-image">
                  <img src={`/assets/${previewImage}`} alt={property.name} />
                  <div className="property-overlay">
                    <span className="photo-count">{totalPropertyPhotos} photos</span>
                  </div>
                </div>
              ) : (
                <div className="property-image placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">📷</div>
                    <div className="placeholder-text">Coming Soon</div>
                    {latestParty.date && (
                      <div className="placeholder-date">
                        {new Date(latestParty.date).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="property-info">
                <h3>{property.name}</h3>
                <p className="property-address">{property.address}</p>
                <div className="property-meta">
                  <span className="event-count">
                    {partyCount} {partyCount === 1 ? 'Event' : 'Events'}
                  </span>
                  <span className="latest-event">Latest: {latestParty.year}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default PropertyListSimple