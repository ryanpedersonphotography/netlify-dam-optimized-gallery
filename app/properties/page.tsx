import PropertyListSimple from '@/components/PropertyListSimple'
import { promises as fs } from 'fs'
import path from 'path'

async function getPropertyData() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'property-data.json')
    const fileContents = await fs.readFile(filePath, 'utf8')
    return JSON.parse(fileContents)
  } catch (error) {
    console.error('Error loading property data:', error)
    return { properties: [] }
  }
}

export default async function PropertiesPage() {
  const propertyData = await getPropertyData()
  
  return <PropertyListSimple properties={propertyData.properties} viewMode="property" />
}