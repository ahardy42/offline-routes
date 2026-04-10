import Dexie, { type EntityTable } from 'dexie'
import type { GeoJSON } from '@we-gold/gpxjs'

export interface SavedRoute {
  id: number
  name: string
  type: 'route' | 'area' | 'explore'
  gpxData?: string
  geojson?: GeoJSON
  bounds?: [[number, number], [number, number]]
  tilesCached: boolean
  createdAt: Date
}

const db = new Dexie('OfflineRoutesDB') as Dexie & {
  routes: EntityTable<SavedRoute, 'id'>
}

db.version(1).stores({
  routes: 'id, name, createdAt',
})

export { db }
