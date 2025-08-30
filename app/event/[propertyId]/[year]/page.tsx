import EnhancedEventGallery from '../../../components/EnhancedEventGallery'
import Link from 'next/link'

interface EventPageProps {
  params: Promise<{
    propertyId: string
    year: string
  }>
}

// Generate static params for known routes
export async function generateStaticParams() {
  return [
    { propertyId: 'the-archive', year: '2025' },
    { propertyId: 'the-archive', year: '2023' },
    { propertyId: 'the-archive', year: '2022' },
    { propertyId: 'the-archive', year: '2020' },
  ]
}

// Enable dynamic rendering for other routes
export const dynamicParams = true

export default async function EventPage({ params }: EventPageProps) {
  const { propertyId, year } = await params

  // Available years for navigation
  const availableYears = ['2020', '2022', '2023', '2025']

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Year Navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/events"
          className="text-blue-600 hover:underline"
        >
          ← Back to Events
        </Link>
        
        <div className="flex gap-2">
          {availableYears.map((yr) => (
            <Link
              key={yr}
              href={`/event/${propertyId}/${yr}`}
              className={`px-4 py-2 rounded ${
                yr === year
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {yr}
            </Link>
          ))}
        </div>
      </div>

      {/* Gallery Component */}
      <h1 className="text-3xl font-bold mb-6">The Archive - {year}</h1>
      <EnhancedEventGallery propertyId={propertyId} year={year} />
    </div>
  )
}