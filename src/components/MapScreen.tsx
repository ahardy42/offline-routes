import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, GeoJSON } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { TileLayerOffline } from 'leaflet.offline'
import { OfflineTileLayer } from './OfflineTileLayer'
import { OfflineIndicator } from './OfflineIndicator'
import { DeleteRouteButton } from './DeleteRouteButton'
import { MapControlButtons } from './MapControlButtons'
import { UserLocationMarker } from './UserLocationMarker'
import { CacheBoundaryOverlay } from './CacheBoundaryOverlay'
import { useTileCache } from '../hooks/useTileCache'
import { useUserLocation } from '../hooks/useUserLocation'
import type { SavedRoute } from '../db'
import { MAX_AREA_SQ_MILES, VT_CENTER, VT_ZOOM, LOCATION_ZOOM } from '../lib/constants'

type MapScreenProps =
  | { route: SavedRoute; onDelete: () => void; onSaveArea?: undefined; onDismiss?: undefined }
  | { route?: undefined; onDelete?: undefined; onSaveArea: (bounds: [[number, number], [number, number]]) => void; onDismiss: () => void }

export function MapScreen(props: MapScreenProps) {
  const { route } = props
  const isExploreMode = !route

  const { status: cacheStatus, progress, cacheTiles } = useTileCache()
  const {
    mode: locationMode,
    position,
    accuracy,
    error: locationError,
    handlePress: handleLocationPress,
    handleLongPress: handleLocationLongPress,
    stopFollowing,
  } = useUserLocation()

  const mapRef = useRef<LeafletMap | null>(null)
  const [tileLayer, setTileLayer] = useState<TileLayerOffline | null>(null)
  const [tileStatus] = useState(
    route?.tilesCached ? 'cached' as const : 'idle' as const
  )
  const actualStatus = cacheStatus === 'idle' ? tileStatus : cacheStatus

  // Explore mode state
  const [exploreArea, setExploreArea] = useState<number>(0)
  const [exploreBounds, setExploreBounds] = useState<[[number, number], [number, number]] | null>(null)
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null)
  const [initialZoom, setInitialZoom] = useState<number>(VT_ZOOM)
  const [geoChecked, setGeoChecked] = useState(!isExploreMode)

  // In explore mode, try to get user location for initial center
  useEffect(() => {
    if (!isExploreMode) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInitialCenter([pos.coords.latitude, pos.coords.longitude])
        setInitialZoom(LOCATION_ZOOM)
        setGeoChecked(true)
      },
      () => {
        setInitialCenter(VT_CENTER)
        setInitialZoom(VT_ZOOM)
        setGeoChecked(true)
      },
      { timeout: 5000 }
    )
  }, [isExploreMode])

  const handleLayerReady = useCallback((layer: TileLayerOffline) => {
    setTileLayer(layer)
  }, [])

  // Auto-start tile caching once the layer is ready (route mode only)
  useEffect(() => {
    if (isExploreMode) return
    if (actualStatus !== 'idle' || !mapRef.current || !tileLayer) return
    cacheTiles(mapRef.current, tileLayer, route.bounds)
  }, [isExploreMode, actualStatus, cacheTiles, route?.bounds, tileLayer])

  function handleRetryCache() {
    if (mapRef.current && tileLayer && route) {
      cacheTiles(mapRef.current, tileLayer, route.bounds)
    }
  }

  function handleFitRoute() {
    if (!route) return
    stopFollowing()
    mapRef.current?.fitBounds(route.bounds, { padding: [20, 20] })
  }

  const handleAreaChange = useCallback((areaSqMiles: number, bounds: [[number, number], [number, number]]) => {
    setExploreArea(areaSqMiles)
    setExploreBounds(bounds)
  }, [])

  function handleSaveArea() {
    if (!exploreBounds || !mapRef.current || !tileLayer) return
    if (exploreArea > MAX_AREA_SQ_MILES) return
    props.onSaveArea!(exploreBounds)
    cacheTiles(mapRef.current, tileLayer, exploreBounds)
  }

  const areaExceeded = exploreArea > MAX_AREA_SQ_MILES

  // Wait for geolocation check in explore mode
  if (isExploreMode && !geoChecked) {
    return <div className="loading">Getting location...</div>
  }

  return (
    <div className="map-screen">
      <div className="map-controls">
        {isExploreMode ? (
          <>
            <span className="area-indicator">
              ~{Math.round(exploreArea)} sq mi
              {areaExceeded && <span className="area-warning"> (max {MAX_AREA_SQ_MILES})</span>}
            </span>
            <button
              className="save-area-btn"
              onClick={handleSaveArea}
              disabled={areaExceeded || !exploreBounds}
            >
              Save Area
            </button>
            <button
              className="dismiss-btn"
              onClick={props.onDismiss}
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <span className="route-name">{route.name}</span>
            <OfflineIndicator
              status={actualStatus}
              progress={progress}
              onRetry={handleRetryCache}
            />
            <DeleteRouteButton onDelete={props.onDelete} />
          </>
        )}
      </div>

      <MapContainer
        center={isExploreMode ? (initialCenter ?? VT_CENTER) : undefined}
        zoom={isExploreMode ? initialZoom : undefined}
        bounds={!isExploreMode ? route.bounds : undefined}
        boundsOptions={!isExploreMode ? { padding: [20, 20] } : undefined}
        className="map-container"
        ref={mapRef}
      >
        <OfflineTileLayer onLayerReady={handleLayerReady} />
        {!isExploreMode && route.geojson && (
          <GeoJSON
            data={route.geojson as unknown as GeoJSON.FeatureCollection}
            style={{ color: '#3388ff', weight: 4 }}
          />
        )}
        {isExploreMode && (
          <CacheBoundaryOverlay onAreaChange={handleAreaChange} />
        )}
        <UserLocationMarker
          position={position}
          accuracy={accuracy}
          mode={locationMode}
        />
      </MapContainer>

      <MapControlButtons
        locationMode={locationMode}
        locationError={locationError}
        onLocationPress={handleLocationPress}
        onLocationLongPress={handleLocationLongPress}
        onFitRoute={handleFitRoute}
        showFitRoute={!isExploreMode}
      />
    </div>
  )
}
