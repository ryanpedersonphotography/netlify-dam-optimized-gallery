import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import PropertyListSimple from './components/PropertyListSimple'
import PropertyDetail from './components/PropertyDetail'
import EventsByYear from './components/EventsByYear'
import EventDetail from './components/EventDetail'
import PhotoGrid from './components/PhotoGrid'
import './App.css'

function App() {
  const [propertyData, setPropertyData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/property-data.json')
      .then(res => res.json())
      .then(data => {
        setPropertyData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading property data:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="loading">Loading asset data...</div>
  }

  if (!propertyData) {
    return <div className="error">Error loading asset data</div>
  }

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>Solhem Digital Assets</h1>
            <nav className="header-nav">
              <Link to="/" className="nav-link">Party Assets</Link>
              <Link to="/by-year" className="nav-link">By Year</Link>
              <Link to="/properties" className="nav-link">By Property</Link>
              <Link to="/photos" className="nav-link">Photo Grid</Link>
            </nav>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<PropertyListSimple properties={propertyData.properties} />} />
            <Route path="/by-year" element={<EventsByYear properties={propertyData.properties} />} />
            <Route path="/properties" element={<PropertyListSimple properties={propertyData.properties} viewMode="property" />} />
            <Route path="/photos" element={<PhotoGrid />} />
            <Route path="/property/:id" element={<PropertyDetail properties={propertyData.properties} />} />
            <Route path="/event/:propertyId/:year" element={<EventDetail properties={propertyData.properties} />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
