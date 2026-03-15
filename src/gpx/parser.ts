import { parseGPX } from '@we-gold/gpxjs'
import type { GeoJSON as GpxGeoJSON } from '@we-gold/gpxjs'

export interface ParsedGpx {
  geojson: GpxGeoJSON
  bounds: [[number, number], [number, number]]
  gpxData: string
}

interface Coords {
  coordinates: number[] | number[][] | number[][][]
}

function computeBounds(geojson: GpxGeoJSON): [[number, number], [number, number]] {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  function processCoords(coords: number[] | number[][] | number[][][]) {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords as number[]
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      return
    }
    for (const c of coords) {
      processCoords(c as number[] | number[][])
    }
  }

  for (const feature of geojson.features) {
    const geom = feature.geometry as Coords
    if (geom && geom.coordinates) {
      processCoords(geom.coordinates)
    }
  }

  if (!isFinite(minLat)) {
    throw new Error('GPX file contains no coordinate data')
  }

  return [[minLat, minLng], [maxLat, maxLng]]
}

export async function parseGpxFile(file: File): Promise<ParsedGpx> {
  const gpxData = await file.text()
  const [parsed, error] = parseGPX(gpxData)

  if (error) {
    throw new Error(`Failed to parse GPX: ${error.message}`)
  }

  const geojson = parsed!.toGeoJSON()

  if (!geojson.features.length) {
    throw new Error('GPX file contains no tracks, routes, or waypoints')
  }

  const bounds = computeBounds(geojson)

  return { geojson, bounds, gpxData }
}
