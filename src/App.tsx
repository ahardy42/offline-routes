import { useState } from 'react'
import { useRoute } from './hooks/useRoute'
import { LandingPage } from './components/LandingPage'
import { MapScreen } from './components/MapScreen'
import type { ParsedGpx } from './gpx/parser'
import './App.css'

function App() {
  const { route, loading, saveRoute, saveArea, deleteRoute } = useRoute()
  const [exploreMode, setExploreMode] = useState(false)

  async function handleRouteLoaded(name: string, parsed: ParsedGpx) {
    await saveRoute(name, parsed)
  }

  async function handleSaveArea(bounds: [[number, number], [number, number]]) {
    await saveArea(bounds)
    setExploreMode(false)
  }

  function handleDismissExplore() {
    setExploreMode(false)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (exploreMode && !route) {
    return (
      <MapScreen
        onSaveArea={handleSaveArea}
        onDismiss={handleDismissExplore}
      />
    )
  }

  if (!route) {
    return (
      <LandingPage
        onRouteLoaded={handleRouteLoaded}
        onExploreMap={() => setExploreMode(true)}
      />
    )
  }

  return <MapScreen route={route} onDelete={deleteRoute} />
}

export default App
