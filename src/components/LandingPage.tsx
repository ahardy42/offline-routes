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
      <div className="landing-topo" />

      <div className="landing-content">
        <header className="landing-header">
          <div className="landing-icon">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3L4 28h24L16 3z" />
              <path d="M16 12v8" />
              <circle cx="16" cy="24" r="1" fill="currentColor" />
            </svg>
          </div>
          <h1>Offline Routes</h1>
        </header>

        <p className="landing-tagline">
          A simple bike computer on your phone. Navigate your ride, see cars behind you, and stay off the grid.
        </p>

        <div className="landing-features">
          <div className="feature-card" style={{ animationDelay: '0.1s' }}>
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            </div>
            <div>
              <strong>Load a route</strong>
              <span>Upload a GPX file from your favorite route planner and see it on the map.</span>
            </div>
          </div>

          <div className="feature-card" style={{ animationDelay: '0.2s' }}>
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12.55a11 11 0 0114.08 0" />
                <path d="M1.42 9a16 16 0 0121.16 0" />
                <path d="M8.53 16.11a6 6 0 016.95 0" />
                <circle cx="12" cy="20" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <strong>Works offline</strong>
              <span>Map tiles are saved to your phone so you can navigate without cell service.</span>
            </div>
          </div>

          <div className="feature-card" style={{ animationDelay: '0.3s' }}>
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
              </svg>
            </div>
            <div>
              <strong>Radar awareness</strong>
              <span>Pair a Garmin Varia over Bluetooth to see vehicles approaching from behind.</span>
            </div>
          </div>

          <div className="feature-card" style={{ animationDelay: '0.4s' }}>
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <strong>Your data stays yours</strong>
              <span>No accounts, no tracking, no uploads. Everything lives on your phone and nowhere else.</span>
            </div>
          </div>
        </div>

        <div className="landing-actions">
          <button
            className="add-route-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <span className="btn-loading">
                <svg className="spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                </svg>
                Loading...
              </span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Add Route
              </>
            )}
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
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none" />
            </svg>
            Explore Map
          </button>

          {error && <p className="error">{error}</p>}
        </div>

        <p className="landing-hint">
          GPX files can be created in apps like Strava, Komoot, or RideWithGPS. Just export your route and open it here.
        </p>
      </div>
    </div>
  )
}
