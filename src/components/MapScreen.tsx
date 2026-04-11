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
import { RadarOverlay } from './RadarOverlay'
import { BleSettingsDrawer } from './BleSettingsDrawer'
import { useTileCache } from '../hooks/useTileCache'
import { useUserLocation } from '../hooks/useUserLocation'
import { useBle } from '../hooks/useBle'
import { MAX_AREA_SQ_MILES, VT_CENTER, VT_ZOOM, LOCATION_ZOOM } from '../lib/constants'
import type { SavedRoute } from '../db'

type MapScreenProps = {
  route: SavedRoute
  onDelete: () => Promise<void>
  onSaveArea: (bounds: [[number, number], [number, number]]) => Promise<void>
  onDismissBoundary: () => Promise<void>
}

export function MapScreen({ route, onDelete, onSaveArea, onDismissBoundary }: MapScreenProps) {
  // Derived from route prop — no local "mode" state needed
  const showBoundary = route.type === 'explore'
  const isRoute = route.type === 'route'
  const hasGeo = isRoute && !!route.geojson
  const hasBounds = !!route.bounds
  const needsGeolocate = !isRoute && !hasBounds

  const { status: cacheStatus, progress, cacheTiles } = useTileCache()
  const {
    bleAvailable,
    connectedDevices,
    radarData,
    batteryLevels,
    requestDevice,
    forgetDevice,
  } = useBle()
  const [bleDrawerOpen, setBleDrawerOpen] = useState(false)
  const hasRadar = Array.from(connectedDevices.values()).some((d) => d.type === 'radar')

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

  // Boundary overlay state (only used when showBoundary)
  const [exploreArea, setExploreArea] = useState<number>(0)
  const [exploreBounds, setExploreBounds] = useState<[[number, number], [number, number]] | null>(null)

  // Geolocation for initial map center (explore/area without bounds)
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null)
  const [initialZoom, setInitialZoom] = useState<number>(VT_ZOOM)
  const [geoChecked, setGeoChecked] = useState(!needsGeolocate)

  useEffect(() => {
    if (!needsGeolocate) return
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
  }, [needsGeolocate])

  const handleLayerReady = useCallback((layer: TileLayerOffline) => {
    setTileLayer(layer)
  }, [])

  // Auto-start tile caching when layer is ready and we have bounds to cache
  useEffect(() => {
    if (showBoundary) return
    if (cacheStatus !== 'idle' || !mapRef.current || !tileLayer || !route?.bounds) return
    cacheTiles(mapRef.current, tileLayer, route.bounds)
  }, [showBoundary, cacheStatus, cacheTiles, route?.bounds, tileLayer])

  function handleRetryCache() {
    if (mapRef.current && tileLayer && route?.bounds) {
      cacheTiles(mapRef.current, tileLayer, route.bounds)
    }
  }

  function handleFitRoute() {
    if (!route?.bounds) return
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
    onSaveArea(exploreBounds)
    cacheTiles(mapRef.current, tileLayer, exploreBounds)
  }

  const areaExceeded = exploreArea > MAX_AREA_SQ_MILES

  // Show caching UI only when there are bounds (something to cache) or caching is active
  const showCacheStatus = hasBounds || cacheStatus !== 'idle'

  if (needsGeolocate && !geoChecked) {
    return <div className="loading">Getting location...</div>
  }

  return (
    <div className="map-screen">
      <div className="map-controls">
        {!isRoute && (
          <button className="back-btn" onClick={onDelete}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {showBoundary ? (
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
            <button className="dismiss-btn" onClick={onDismissBoundary}>
              Dismiss
            </button>
          </>
        ) : (
          <>
            <span className="route-name">{route?.name}</span>
            {showCacheStatus && (
              <OfflineIndicator
                status={cacheStatus}
                progress={progress}
                onRetry={handleRetryCache}
              />
            )}
            {isRoute && <DeleteRouteButton onDelete={onDelete} />}
          </>
        )}
      </div>

      <MapContainer
        center={needsGeolocate ? (initialCenter ?? VT_CENTER) : undefined}
        zoom={needsGeolocate ? initialZoom : undefined}
        bounds={hasBounds ? route.bounds : undefined}
        boundsOptions={hasBounds ? { padding: [20, 20] } : undefined}
        className="map-container"
        ref={mapRef}
        zoomControl={false}
      >
        <OfflineTileLayer onLayerReady={handleLayerReady} />
        {hasGeo && (
          <GeoJSON
            data={route.geojson as unknown as GeoJSON.FeatureCollection}
            style={{ color: '#3388ff', weight: 4 }}
          />
        )}
        {showBoundary && (
          <CacheBoundaryOverlay onAreaChange={handleAreaChange} />
        )}
        <UserLocationMarker
          position={position}
          accuracy={accuracy}
          mode={locationMode}
        />
      </MapContainer>

      {hasRadar && <RadarOverlay threats={radarData} />}

      <MapControlButtons
        locationMode={locationMode}
        locationError={locationError}
        onLocationPress={handleLocationPress}
        onLocationLongPress={handleLocationLongPress}
        onFitRoute={handleFitRoute}
        showFitRoute={isRoute}
        onBlePress={() => setBleDrawerOpen((v) => !v)}
        bleConnected={connectedDevices.size > 0}
        bleAvailable={bleAvailable}
      />

      <BleSettingsDrawer
        open={bleDrawerOpen}
        onClose={() => setBleDrawerOpen(false)}
        connectedDevices={connectedDevices}
        batteryLevels={batteryLevels}
        onRequestDevice={requestDevice}
        onForgetDevice={forgetDevice}
      />
    </div>
  )
}
