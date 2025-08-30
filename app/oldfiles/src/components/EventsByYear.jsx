import { useState } from 'react'
import { Link } from 'react-router-dom'
import './EventsByYear.css'

const EventsByYear = ({ properties }) => {
  const [selectedYear, setSelectedYear] = useState(2025)
  
  // Get all unique years from all properties
  const allYears = new Set()
  properties.forEach(property => {
    if (property.events && property.events.parties) {
      property.events.parties.forEach(party => {
        allYears.add(party.year)
      })
    }
  })
  const years = Array.from(allYears).sort((a, b) => b - a)
  
  // Get events for selected year
  const eventsForYear = []
  properties.forEach(property => {
    if (property.events && property.events.parties) {
      const party = property.events.parties.find(p => p.year === selectedYear)
      if (party) {
        eventsForYear.push({
          property,
          party
        })
      }
    }
  })
  
  return (
    <div className="events-by-year">
      <div className="year-selector">
        <h2>Party Assets by Year</h2>
        <div className="year-tabs">
          {years.map(year => (
            <button
              key={year}
              className={`year-tab ${year === selectedYear ? 'active' : ''}`}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      
      <div className="events-grid">
        {eventsForYear.length > 0 ? (
          eventsForYear.map(({ property, party }) => {
            const topCount = party.assets.top.length
            const allCount = party.assets.all.length
            const previewImage = party.assets.top[0] || party.assets.all[0]
            
            return (
              <Link
                key={`${property.id}-${party.year}`}
                to={`/event/${property.id}/${party.year}`}
                className="event-card"
              >
                {previewImage && (
                  <div className="event-image">
                    <img src={`/assets/${previewImage}`} alt={property.name} />
                    <div className="event-overlay">
                      <div className="photo-counts">
                        <span className="top-count">{topCount} Top Picks</span>
                        <span className="all-count">{allCount} Total Photos</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="event-info">
                  <h3>{property.name}</h3>
                  <p className="event-date">{new Date(party.date).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}</p>
                  <p className="event-description">{party.description}</p>
                </div>
              </Link>
            )
          })
        ) : (
          <div className="no-events">
            <p>No events for {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventsByYear