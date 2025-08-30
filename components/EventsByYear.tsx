'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Asset {
  top: string[]
  all: string[]
}

interface Party {
  year: number
  date: string
  description: string
  assets: Asset
}

interface Events {
  parties: Party[]
}

interface Property {
  id: string
  name: string
  address: string
  events: Events
}

interface EventsByYearProps {
  properties: Property[]
}

const EventsByYear = ({ properties }: EventsByYearProps) => {
  const [selectedYear, setSelectedYear] = useState(2025)
  
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
        eventsForYear.push({
          property,
          party
        })
      }
    }
  })
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Year Selector */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Party Assets by Year</h2>
          <div className="flex flex-wrap gap-2">
            {years.map(year => (
              <button
                key={year}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  year === selectedYear
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {eventsForYear.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventsForYear.map(({ property, party }) => {
              const topCount = party.assets.top.length
              const allCount = party.assets.all.length
              const previewImage = party.assets.top[0] || party.assets.all[0]
              
              return (
                <Link
                  key={`${property.id}-${party.year}`}
                  href={`/event/${property.id}/${party.year}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {previewImage && (
                    <div className="relative h-48">
                      <Image
                        src={`/assets/${previewImage}`}
                        alt={property.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-25 flex items-end">
                        <div className="p-4">
                          <div className="space-y-1">
                            <div className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium">
                              {topCount} Top Picks
                            </div>
                            <div className="bg-white bg-opacity-90 text-gray-900 px-2 py-1 rounded text-sm">
                              {allCount} Total Photos
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {property.name}
                    </h3>
                    <p className="text-blue-600 text-sm font-medium mb-2">
                      {new Date(party.date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {party.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-lg">No events for {selectedYear}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventsByYear