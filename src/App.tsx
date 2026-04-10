import { useRoute } from './hooks/useRoute'
import { LandingPage } from './components/LandingPage'
import { MapScreen } from './components/MapScreen'
import type { ParsedGpx } from './gpx/parser'
import './App.css'

function App() {
  const { route, loading, saveRoute, saveArea, dismissExplore, deleteRoute } = useRoute()

  async function handleRouteLoaded(name: string, parsed: ParsedGpx) {
    await saveRoute(name, parsed)
  }

  async function handleSaveArea(bounds: [[number, number], [number, number]]) {
    await saveArea(bounds)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!route) {
    return (
      <LandingPage
        onRouteLoaded={handleRouteLoaded}
        onExploreMap={() => saveRoute('Explore')}
      />
    )
  }

  return <MapScreen route={route} onSaveArea={handleSaveArea} onDelete={deleteRoute} onDismissBoundary={dismissExplore} />
}

export default App
