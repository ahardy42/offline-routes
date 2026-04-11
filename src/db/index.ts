import Dexie, { type EntityTable } from 'dexie'
import type { GeoJSON } from '@we-gold/gpxjs'
import type { BleDeviceType } from '../lib/ble'

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

export interface SavedDevice {
  id: string // BluetoothDevice.id — persists across sessions
  name: string
  type: BleDeviceType
  lastConnected: Date
}

const db = new Dexie('OfflineRoutesDB') as Dexie & {
  routes: EntityTable<SavedRoute, 'id'>
  devices: EntityTable<SavedDevice, 'id'>
}

db.version(1).stores({
  routes: 'id, name, createdAt',
})

db.version(2).stores({
  routes: 'id, name, createdAt',
  devices: 'id, type',
})

export { db }
