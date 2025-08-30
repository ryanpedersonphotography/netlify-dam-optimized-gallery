import Link from 'next/link'
import Image from 'next/image'

interface Asset {
  top?: string[]
  all?: string[]
}

interface Party {
  year: number
  date?: string
  description?: string
  assets: Asset
  upcoming?: boolean
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

interface PropertyListSimpleProps {
  properties: Property[]
  viewMode?: 'parties' | 'property'
}

const PropertyListSimple = ({ properties, viewMode = 'parties' }: PropertyListSimpleProps) => {
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Solhem Party Photo Archive
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Professional event documentation for our residential communities
            </p>
            
            {/* Stats Row */}
            <div className="flex justify-center space-x-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {propertiesWithParties.length}
                </div>
                <div className="text-sm text-gray-500">Properties</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {totalEvents}
                </div>
                <div className="text-sm text-gray-500">Events</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {totalPhotos.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Photos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Property Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Select a Property</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {propertiesWithParties.map(property => {
            const latestParty = property.events.parties[property.events.parties.length - 1]
            const partyCount = property.events.parties.length
            const totalPropertyPhotos = property.events.parties.reduce((sum, party) => {
              return sum + (party.assets?.all?.length || 0)
            }, 0)
            const previewImage = latestParty.assets?.top?.[0] || latestParty.assets?.all?.[0]
            const isUpcoming = latestParty.upcoming === true
            
            const linkHref = isUpcoming ? '#' : `/event/${property.id}/${latestParty.year}`
            
            return (
              <div key={property.id} className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${isUpcoming ? 'opacity-60' : ''}`}>
                {isUpcoming ? (
                  <div className="cursor-not-allowed">
                    <PropertyCard 
                      property={property}
                      latestParty={latestParty}
                      previewImage={previewImage}
                      totalPropertyPhotos={totalPropertyPhotos}
                      partyCount={partyCount}
                      isUpcoming={isUpcoming}
                    />
                  </div>
                ) : (
                  <Link href={linkHref}>
                    <PropertyCard 
                      property={property}
                      latestParty={latestParty}
                      previewImage={previewImage}
                      totalPropertyPhotos={totalPropertyPhotos}
                      partyCount={partyCount}
                      isUpcoming={isUpcoming}
                    />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface PropertyCardProps {
  property: Property
  latestParty: Party
  previewImage?: string
  totalPropertyPhotos: number
  partyCount: number
  isUpcoming: boolean
}

const PropertyCard = ({ 
  property, 
  latestParty, 
  previewImage, 
  totalPropertyPhotos, 
  partyCount, 
  isUpcoming 
}: PropertyCardProps) => (
  <>
    {previewImage ? (
      <div className="relative h-48">
        <Image
          src={`/assets/${previewImage}`}
          alt={property.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-black bg-opacity-25 flex items-end">
          <div className="p-4">
            <span className="bg-white bg-opacity-90 text-gray-900 px-2 py-1 rounded text-sm font-medium">
              {totalPropertyPhotos} photos
            </span>
          </div>
        </div>
      </div>
    ) : (
      <div className="h-48 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">📷</div>
          <div className="text-gray-600 font-medium">Coming Soon</div>
          {latestParty.date && (
            <div className="text-gray-500 text-sm mt-1">
              {new Date(latestParty.date).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric'
              })}
            </div>
          )}
        </div>
      </div>
    )}
    
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{property.name}</h3>
      <p className="text-gray-600 text-sm mb-3">{property.address}</p>
      <div className="flex justify-between text-sm text-gray-500">
        <span>{partyCount} {partyCount === 1 ? 'Event' : 'Events'}</span>
        <span>Latest: {latestParty.year}</span>
      </div>
    </div>
  </>
)

export default PropertyListSimple