import { useEffect, useState, useCallback } from 'react'
import { Rectangle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { SQ_METERS_TO_SQ_MILES, MAX_AREA_SQ_MILES } from '../lib/constants'

function calcAreaSqMiles(bounds: L.LatLngBounds): number {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const nw = L.latLng(ne.lat, sw.lng)

  const height = sw.distanceTo(nw)
  const width = sw.distanceTo(L.latLng(sw.lat, ne.lng))

  return height * width * SQ_METERS_TO_SQ_MILES
}

function insetBounds(bounds: L.LatLngBounds, fraction: number): L.LatLngBounds {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const dLat = (ne.lat - sw.lat) * fraction
  const dLng = (ne.lng - sw.lng) * fraction
  return L.latLngBounds(
    [sw.lat + dLat, sw.lng + dLng],
    [ne.lat - dLat, ne.lng - dLng],
  )
}

interface CacheBoundaryOverlayProps {
  onAreaChange: (areaSqMiles: number, bounds: [[number, number], [number, number]]) => void
}

export function CacheBoundaryOverlay({ onAreaChange }: CacheBoundaryOverlayProps) {
  const [rectBounds, setRectBounds] = useState<L.LatLngBounds | null>(null)
  const [isTooLarge, setIsTooLarge] = useState<boolean>(false)

  const updateBounds = useCallback((map: L.Map) => {
    const bounds = map.getBounds()
    const inset = insetBounds(bounds, 0.05)
    setRectBounds(inset)

    const area = calcAreaSqMiles(inset)
    setIsTooLarge(area > MAX_AREA_SQ_MILES)
    const sw = inset.getSouthWest()
    const ne = inset.getNorthEast()
    onAreaChange(area, [[sw.lat, sw.lng], [ne.lat, ne.lng]])
  }, [onAreaChange])

  const map = useMapEvents({
    move: () => updateBounds(map),
    moveend: () => updateBounds(map),
    zoomend: () => updateBounds(map),
  })

  // Fire initial bounds calculation via a synthetic event
  useEffect(() => {
    map.fireEvent('moveend')
  }, [map])

  if (!rectBounds) return null

  return (
    <Rectangle
      bounds={rectBounds}
      pathOptions={{
        color: isTooLarge ? '#d32f2f' : '#3388ff',
        weight: 2,
        dashArray: '8 6',
        fill: false,
      }}
    />
  )
}
