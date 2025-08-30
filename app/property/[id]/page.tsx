'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PropertyDetail from '@/components/PropertyDetail'
import { promises as fs } from 'fs'
import path from 'path'

interface PropertyPageProps {
  params: Promise<{
    id: string
  }>
}

// This would typically be loaded from your data source
const mockSuites = [
  {
    id: '1',
    name: 'Suite 101',
    property: 'Test Property Address',
    images: ['suite1_1.jpg', 'suite1_2.jpg']
  },
  {
    id: '2', 
    name: 'Suite 202',
    property: 'Test Property Address',
    images: ['suite2_1.jpg', 'suite2_2.jpg']
  }
]

export default function PropertyPage({ params }: PropertyPageProps) {
  const router = useRouter()
  const [propertyId, setPropertyId] = useState<string>('')
  const [propertyData, setPropertyData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(async (resolved) => {
      setPropertyId(resolved.id)
      
      try {
        // Load property data - this would come from your API/storage
        const response = await fetch('/property-data.json')
        const data = await response.json()
        const property = data.properties.find((p: any) => p.id === resolved.id)
        
        if (property) {
          setPropertyData(property)
        }
      } catch (error) {
        console.error('Failed to load property data:', error)
      } finally {
        setLoading(false)
      }
    })
  }, [params])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading property...</div>
      </div>
    )
  }

  if (!propertyData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Property Not Found
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Property ID: <span className="font-semibold">{propertyId}</span>
            </p>
            <button
              onClick={() => router.push('/properties')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Properties
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PropertyDetail
      property={propertyData}
      suites={mockSuites}
      onBack={() => router.push('/properties')}
    />
  )
}