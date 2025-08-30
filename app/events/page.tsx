'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Party {
  year: number
  date: string
  time?: string
  attendees?: number | null
  description: string
  upcoming?: boolean
  assets: {
    top: string[]
    all: string[]
  }
}

interface Property {
  id: string
  name: string
  address: string
  events: {
    parties: Party[]
  }
}

export default function EventsByYear() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load property data
    fetch('/property-data.json')
      .then(res => res.json())
      .then(data => {
        setProperties(data.properties)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading property data:', err)
        setLoading(false)
      })
  }, [])

  // Get all unique years from all properties
  const allYears = new Set<number>()
  properties.forEach(property => {
    if (property.events && property.events.parties) {
      property.events.parties.forEach(party => {
        allYears.add(party.year)
      })
    }
  })
  const years = Array.from(allYears).sort((a, b) => b - a)

  // Get events for selected year
  const eventsForYear: { property: Property; party: Party }[] = []
  properties.forEach(property => {
    if (property.events && property.events.parties) {
      const party = property.events.parties.find(p => p.year === selectedYear)
      if (party) {
        eventsForYear.push({ property, party })
      }
    }
  })

  if (loading) {
    return <div className="loading-container">Loading party data...</div>
  }

  return (
    <div className="events-page">
      <div className="events-container">
        <div className="events-header">
          <h1 className="events-title">Party Archive by Year</h1>
          <p className="events-subtitle">Browse party events across all Solhem properties</p>
          
          {/* Year selector tabs */}
          <div className="year-tabs">
            {years.map(year => (
              <button
                key={year}
                className={`year-tab ${year === selectedYear ? 'active' : 'inactive'}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

      {/* Events grid */}
      <div className="events-grid">
        {eventsForYear.length > 0 ? (
          eventsForYear.map(({ property, party }) => {
            const topCount = party.assets.top.length
            const allCount = party.assets.all.length
            const previewImage = party.assets.top[0] || party.assets.all[0]

            return (
              <Link
                key={`${property.id}-${party.year}`}
                href={`/event/${property.id}/${party.year}`}
                className="event-card"
              >
                {previewImage ? (
                  <div className="event-card-image-container">
                    <Image
                      src={`/api/photos/image?key=${previewImage}`}
                      alt={property.name}
                      fill
                      className="event-card-image"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="event-card-overlay">
                      <div className="event-card-overlay-content">
                        <div className="event-card-stats">
                          <div>
                            <span className="event-card-top-count">{topCount} Top Picks</span>
                            <span className="event-card-total-count">{allCount} Total Photos</span>
                          </div>
                          <svg className="event-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="event-card-placeholder">
                    <div className="event-card-placeholder-icon">
                      <svg className="placeholder-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="event-card-placeholder-text">
                      {topCount + allCount > 0 ? `${topCount + allCount} photos` : 'No photos yet'}
                    </span>
                  </div>
                )}
                
                <div className="event-card-content">
                  <div className="event-card-header">
                    <h3 className="event-card-title">
                      {property.name}
                    </h3>
                    {party.upcoming && (
                      <span className="event-card-upcoming-badge">
                        <span className="event-card-upcoming-dot"></span>
                        Upcoming
                      </span>
                    )}
                  </div>
                  <p className="event-card-date">
                    <svg className="event-card-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(party.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    {party.time && <span className="event-card-time">• {party.time}</span>}
                  </p>
                  <p className="event-card-description">{party.description}</p>
                </div>
              </Link>
            )
          })
        ) : (
          <div className="events-no-data">
            <div className="events-no-data-card">
              <svg className="events-no-data-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="events-no-data-title">No parties found for {selectedYear}</p>
              <p className="events-no-data-subtitle">Try selecting a different year</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}