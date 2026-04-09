import { useState, useEffect, useCallback } from 'react'
import { db, type SavedRoute } from '../db'
import type { ParsedGpx } from '../gpx/parser'

export function useRoute() {
  const [route, setRoute] = useState<SavedRoute | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.routes.get(1).then((r) => {
      setRoute(r ?? null)
      setLoading(false)
    })
  }, [])

  const saveRoute = useCallback(async (name: string, parsed: ParsedGpx) => {
    const saved: SavedRoute = {
      id: 1,
      name,
      type: 'route',
      gpxData: parsed.gpxData,
      geojson: parsed.geojson,
      bounds: parsed.bounds,
      tilesCached: false,
      createdAt: new Date(),
    }
    await db.routes.put(saved)
    setRoute(saved)
  }, [])

  const saveArea = useCallback(async (bounds: [[number, number], [number, number]]) => {
    const saved: SavedRoute = {
      id: 1,
      name: 'Saved Area',
      type: 'area',
      bounds,
      tilesCached: false,
      createdAt: new Date(),
    }
    await db.routes.put(saved)
    setRoute(saved)
  }, [])

  const deleteRoute = useCallback(async () => {
    await db.routes.delete(1)
    // Clear leaflet.offline tile cache
    const dbs = await indexedDB.databases()
    for (const dbInfo of dbs) {
      if (dbInfo.name && dbInfo.name.includes('leaflet.offline')) {
        indexedDB.deleteDatabase(dbInfo.name)
      }
    }
    setRoute(null)
  }, [])

  return { route, loading, saveRoute, saveArea, deleteRoute }
}
