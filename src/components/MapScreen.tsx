import { useCallback, useRef, useState } from 'react'
import { MapContainer, GeoJSON } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { TileLayerOffline } from 'leaflet.offline'
import { OfflineTileLayer } from './OfflineTileLayer'
import { OfflineIndicator } from './OfflineIndicator'
import { DeleteRouteButton } from './DeleteRouteButton'
import { MapControlButtons } from './MapControlButtons'
import { UserLocationMarker } from './UserLocationMarker'
import { useTileCache } from '../hooks/useTileCache'
import { useUserLocation } from '../hooks/useUserLocation'
import type { SavedRoute } from '../db'

interface MapScreenProps {
  route: SavedRoute
  onDelete: () => void
}

export function MapScreen({ route, onDelete }: MapScreenProps) {
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
  const layerRef = useRef<TileLayerOffline | null>(null)
  const [tileStatus] = useState(
    route.tilesCached ? 'cached' as const : 'idle' as const
  )
  const actualStatus = cacheStatus === 'idle' ? tileStatus : cacheStatus

  const handleLayerReady = useCallback((layer: TileLayerOffline) => {
    layerRef.current = layer
  }, [])

  function handleCache() {
    if (mapRef.current && layerRef.current) {
      cacheTiles(mapRef.current, layerRef.current, route.bounds)
    }
  }

  function handleFitRoute() {
    stopFollowing()
    mapRef.current?.fitBounds(route.bounds, { padding: [20, 20] })
  }

  return (
    <div className="map-screen">
      <div className="map-controls">
        <span className="route-name">{route.name}</span>
        <OfflineIndicator
          status={actualStatus}
          progress={progress}
          onCache={handleCache}
        />
        <DeleteRouteButton onDelete={onDelete} />
      </div>

      <MapContainer
        bounds={route.bounds}
        boundsOptions={{ padding: [20, 20] }}
        className="map-container"
        ref={mapRef}
      >
        <OfflineTileLayer onLayerReady={handleLayerReady} />
        <GeoJSON
          data={route.geojson as unknown as GeoJSON.FeatureCollection}
          style={{ color: '#3388ff', weight: 4 }}
        />
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
      />
    </div>
  )
}
