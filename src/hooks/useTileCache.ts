import { useState, useCallback } from 'react'
import L from 'leaflet'
import { savetiles, type SaveStatus } from 'leaflet.offline'
import type { TileLayerOffline } from 'leaflet.offline'
import { db } from '../db'

export type CacheStatus = 'idle' | 'downloading' | 'cached' | 'error'

export function useTileCache() {
  const [status, setStatus] = useState<CacheStatus>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const cacheTiles = useCallback(async (
    map: L.Map,
    layer: TileLayerOffline,
    bounds: [[number, number], [number, number]],
  ) => {
    const leafletBounds = L.latLngBounds(bounds[0], bounds[1])

    try {
      const control = savetiles(layer as unknown as TileLayerOffline, {
        zoomlevels: [10, 11, 12, 13, 14, 15],
        bounds: leafletBounds,
        confirm: (_: SaveStatus, successCallback: () => void) => {
          successCallback()
        },
        parallel: 5,
        alwaysDownload: false,
      })

      control.addTo(map)

      setStatus('downloading')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onSaveStart = (e: any) => {
        setProgress({ done: 0, total: (e as SaveStatus)._tilesforSave.length })
      }
      const onSaveTileEnd = () => {
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }))
      }
      const cleanup = () => {
        layer.off('savestart', onSaveStart)
        layer.off('savetileend', onSaveTileEnd)
        layer.off('loadend', onLoadEnd)
        layer.off('tilesaveerror', onError)
      }
      const onLoadEnd = async () => {
        await db.routes.update(1, { tilesCached: true })
        setStatus('cached')
        control.remove()
        cleanup()
      }
      const onError = () => {
        setStatus('error')
        control.remove()
        cleanup()
      }

      layer.on('savestart', onSaveStart)
      layer.on('savetileend', onSaveTileEnd)
      layer.on('loadend', onLoadEnd)
      layer.on('tilesaveerror', onError)

      // Trigger the save
      control._saveTiles()
    } catch (e) {
      console.error('Tile caching failed:', e)
      setStatus('error')
    }
  }, [])

  return { status, progress, cacheTiles }
}
