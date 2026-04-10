import { useRef, useState } from 'react'
import { parseGpxFile } from '../gpx/parser'
import type { ParsedGpx } from '../gpx/parser'

interface LandingPageProps {
  onRouteLoaded: (name: string, parsed: ParsedGpx) => Promise<void>
  onExploreMap: () => Promise<void>
}

export function LandingPage({ onRouteLoaded, onExploreMap }: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setLoading(true)

    try {
      const parsed = await parseGpxFile(file)
      const name = file.name.replace(/\.gpx$/i, '')
      await onRouteLoaded(name, parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse GPX file')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="landing">
      <div className="landing-content">
        <h1>Offline Routes</h1>
        <p>Upload a GPX file to view and cache your route for offline use.</p>

        <button
          className="add-route-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Add Route'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          onChange={handleFile}
          hidden
        />

        <button
          className="explore-btn"
          onClick={onExploreMap}
        >
          Just Go to Map
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
