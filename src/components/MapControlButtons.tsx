import { useRef, useCallback } from 'react'
import type { LocationMode } from '../hooks/useUserLocation'

interface MapControlButtonsProps {
  locationMode: LocationMode
  locationError: string | null
  onLocationPress: () => void
  onLocationLongPress: () => void
  onFitRoute: () => void
  showFitRoute?: boolean
}

const LONG_PRESS_MS = 600

export function MapControlButtons({
  locationMode,
  locationError,
  onLocationPress,
  onLocationLongPress,
  onFitRoute,
  showFitRoute = true,
}: MapControlButtonsProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onLocationLongPress()
    }, LONG_PRESS_MS)
  }, [onLocationLongPress])

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    if (!didLongPress.current) {
      onLocationPress()
    }
  }, [onLocationPress])

  const handlePointerLeave = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }, [])

  function getLocationIcon() {
    switch (locationMode) {
      case 'off':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        )
      case 'locating':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        )
      case 'showing':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" />
          </svg>
        )
      case 'following':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" />
            <circle cx="12" cy="12" r="9" fill="none" strokeDasharray="4 2" />
          </svg>
        )
    }
  }

  return (
    <div className="map-btn-group">
      <button
        className={`map-btn location-btn ${locationMode}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        title={
          locationMode === 'off' ? 'Show location' :
          locationMode === 'locating' ? 'Locating...' :
          locationMode === 'showing' ? 'Follow location' :
          'Stop following'
        }
      >
        {getLocationIcon()}
      </button>
      {showFitRoute && (
        <button
          className="map-btn fit-route-btn"
          onClick={onFitRoute}
          title="Fit route"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      )}
      {locationError && (
        <div className="location-error">{locationError}</div>
      )}
    </div>
  )
}
