import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LocationMode } from '../hooks/useUserLocation'

// The CircleMarker has radius 8px. At any given zoom, we can compute how many
// meters that covers. If the accuracy radius in meters is smaller than that,
// the ring would be inside the dot — so we hide it.
function markerRadiusInMeters(map: L.Map, markerPxRadius: number): number {
  const center = map.getCenter()
  const pointA = map.latLngToContainerPoint(center)
  const pointB = L.point(pointA.x + markerPxRadius, pointA.y)
  const latlngB = map.containerPointToLatLng(pointB)
  return center.distanceTo(latlngB)
}

const MARKER_PX_RADIUS = 8
const HEADING_PANE = 'user-heading-pane'
const HEADING_OVERLAY_SIZE = 120
const HEADING_OVERLAY_RADIUS = 48

function createHeadingIcon(heading: number): L.DivIcon {
  const center = HEADING_OVERLAY_SIZE / 2
  const radius = HEADING_OVERLAY_RADIUS

  return L.divIcon({
    className: 'user-heading-indicator',
    iconSize: [HEADING_OVERLAY_SIZE, HEADING_OVERLAY_SIZE],
    iconAnchor: [center, center],
    html: `
      <svg
        width="${HEADING_OVERLAY_SIZE}"
        height="${HEADING_OVERLAY_SIZE}"
        viewBox="0 0 ${HEADING_OVERLAY_SIZE} ${HEADING_OVERLAY_SIZE}"
        aria-hidden="true"
        style="display:block; overflow:visible; transform:rotate(${heading}deg); transform-origin:${center}px ${center}px;"
      >
        <defs>
          <radialGradient id="user-heading-cone" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#4285f4" stop-opacity="0.42" />
            <stop offset="65%" stop-color="#4285f4" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#4285f4" stop-opacity="0.04" />
          </radialGradient>
        </defs>
        <path
          d="M ${center} ${center} L ${center - 26} ${center - 34} A ${radius} ${radius} 0 0 1 ${center + 26} ${center - 34} Z"
          fill="url(#user-heading-cone)"
        />
      </svg>
    `,
  })
}

function ensureHeadingPane(map: L.Map): string {
  if (!map.getPane(HEADING_PANE)) {
    const pane = map.createPane(HEADING_PANE)
    pane.style.zIndex = '390'
    pane.style.pointerEvents = 'none'
  }

  return HEADING_PANE
}

interface UserLocationMarkerProps {
  position: [number, number] | null
  heading: number | null
  accuracy: number | null
  mode: LocationMode
}

export function UserLocationMarker({ position, accuracy, mode, heading }: UserLocationMarkerProps) {
  const map = useMap()
  const markerRef = useRef<L.CircleMarker | null>(null)
  const accuracyRef = useRef<L.Circle | null>(null)
  const headingRef = useRef<L.Marker | null>(null)
  const hasFlewToRef = useRef(false)

  // Reset fly-to tracking when location is turned off
  useEffect(() => {
    if (mode === 'off') {
      hasFlewToRef.current = false
    }
  }, [mode])

  // Create/update/remove marker and accuracy ring
  useEffect(() => {
    if (!position || mode === 'off') {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      if (accuracyRef.current) {
        accuracyRef.current.remove()
        accuracyRef.current = null
      }
      if (headingRef.current) {
        headingRef.current.remove()
        headingRef.current = null
      }
      return
    }

    const latlng = L.latLng(position[0], position[1])
    const accuracyMeters = accuracy ?? 0
    const markerMeters = markerRadiusInMeters(map, MARKER_PX_RADIUS)
    const showRing = accuracyMeters > markerMeters

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latlng, {
        radius: MARKER_PX_RADIUS,
        fillColor: '#4285f4',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 3,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng(latlng)
    }

    if (heading === null) {
      if (headingRef.current) {
        headingRef.current.remove()
        headingRef.current = null
      }
    } else if (!headingRef.current) {
      headingRef.current = L.marker(latlng, {
        icon: createHeadingIcon(heading),
        pane: ensureHeadingPane(map),
        interactive: false,
        keyboard: false,
      }).addTo(map)
    } else {
      headingRef.current.setLatLng(latlng)
      headingRef.current.setIcon(createHeadingIcon(heading))
    }

    if (showRing) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(latlng, {
          radius: accuracyMeters,
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          color: '#4285f4',
          weight: 1,
          opacity: 0.3,
        }).addTo(map)
      } else {
        accuracyRef.current.setLatLng(latlng)
        accuracyRef.current.setRadius(accuracyMeters)
      }
    } else if (accuracyRef.current) {
      accuracyRef.current.remove()
      accuracyRef.current = null
    }

    // Fly to user on first fix
    if (!hasFlewToRef.current) {
      hasFlewToRef.current = true
      map.flyTo(position, 15, { duration: 1 })
      return
    }

    // Follow user
    if (mode === 'following') {
      map.setView(position, map.getZoom(), { animate: true })
    }
  }, [position, accuracy, mode, heading, map])

  // Update ring visibility when zoom changes (marker pixel size changes relative to meters)
  useEffect(() => {
    function onZoom() {
      if (!accuracyRef.current || !accuracy) return
      const markerMeters = markerRadiusInMeters(map, MARKER_PX_RADIUS)
      if (accuracy <= markerMeters) {
        accuracyRef.current.remove()
        accuracyRef.current = null
      }
    }

    function onZoomEnd() {
      if (!markerRef.current || !accuracy || mode === 'off') return
      const markerMeters = markerRadiusInMeters(map, MARKER_PX_RADIUS)
      if (accuracy > markerMeters && !accuracyRef.current) {
        const latlng = markerRef.current.getLatLng()
        accuracyRef.current = L.circle(latlng, {
          radius: accuracy,
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          color: '#4285f4',
          weight: 1,
          opacity: 0.3,
        }).addTo(map)
      }
    }

    map.on('zoom', onZoom)
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoom', onZoom)
      map.off('zoomend', onZoomEnd)
    }
  }, [map, accuracy, mode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markerRef.current?.remove()
      accuracyRef.current?.remove()
      headingRef.current?.remove()
    }
  }, [])

  return null
}
