import { useRoute } from './hooks/useRoute'
import { LandingPage } from './components/LandingPage'
import { MapScreen } from './components/MapScreen'
import type { ParsedGpx } from './gpx/parser'
import './App.css'

function App() {
  const { route, loading, saveRoute, deleteRoute } = useRoute()

  async function handleRouteLoaded(name: string, parsed: ParsedGpx) {
    await saveRoute(name, parsed)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!route) {
    return <LandingPage onRouteLoaded={handleRouteLoaded} />
  }

  return <MapScreen route={route} onDelete={deleteRoute} />
}

export default App
