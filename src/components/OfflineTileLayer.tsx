import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { tileLayerOffline, type TileLayerOffline as TileLayerOfflineType } from 'leaflet.offline'

interface OfflineTileLayerProps {
  onLayerReady?: (layer: TileLayerOfflineType) => void
}

export function OfflineTileLayer({ onLayerReady }: OfflineTileLayerProps) {
  const map = useMap()
  const layerRef = useRef<TileLayerOfflineType | null>(null)

  useEffect(() => {
    if (layerRef.current) return

    const layer = tileLayerOffline(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
        subdomains: 'abc',
      }
    )

    layer.addTo(map)
    layerRef.current = layer
    onLayerReady?.(layer)

    return () => {
      layer.remove()
      layerRef.current = null
    }
  }, [map, onLayerReady])

  return null
}
