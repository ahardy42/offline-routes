declare module 'leaflet.offline' {
  import type { TileLayerOptions, TileLayer, Control, ControlOptions, LatLngBounds, Map, DomEvent, Bounds, Point } from 'leaflet'

  export interface TileInfo {
    key: string
    url: string
    x: number
    y: number
    z: number
    urlTemplate: string
    createdAt: number
  }

  export interface StoredTile extends TileInfo {
    blob: Blob
  }

  export interface SaveTileOptions extends ControlOptions {
    saveText: string
    rmText: string
    maxZoom: number
    saveWhatYouSee: boolean
    bounds: LatLngBounds | null
    confirm: ((status: SaveStatus, successCallback: () => void) => void) | null
    confirmRemoval: ((status: SaveStatus, successCallback: () => void) => void) | null
    parallel: number
    zoomlevels?: number[]
    alwaysDownload: boolean
  }

  export interface SaveStatus {
    _tilesforSave: TileInfo[]
    storagesize: number
    lengthToBeSaved: number
    lengthSaved: number
    lengthLoaded: number
  }

  export interface TileLayerOffline extends TileLayer {
    getTileUrls(bounds: Bounds, zoom: number): TileInfo[]
  }

  export class ControlSaveTiles extends Control {
    _map: Map
    _refocusOnMap: DomEvent.EventHandlerFn
    _baseLayer: TileLayerOffline
    options: SaveTileOptions
    status: SaveStatus
    _saveTiles(): void
    _calculateTiles(): TileInfo[]
    _rmTiles(): void
    setLayer(layer: TileLayerOffline): void
  }

  export function tileLayerOffline(
    urlTemplate: string,
    options?: TileLayerOptions
  ): TileLayerOffline

  export function savetiles(
    baseLayer: TileLayerOffline,
    options: Partial<SaveTileOptions>
  ): ControlSaveTiles

  export function downloadTile(url: string): Promise<Blob>
  export function saveTile(tileInfo: TileInfo, blob: Blob): Promise<void>
  export function getBlobByKey(key: string): Promise<Blob>
  export function hasTile(key: string): Promise<boolean>
  export function truncate(): Promise<void>
  export function getStorageLength(): Promise<number>
  export function getStorageInfo(urlTemplate: string): Promise<StoredTile[]>
  export function getTileUrl(urlTemplate: string, data: Record<string, unknown>): string
  export function getTilePoints(area: Bounds, tileSize: Point): Point[]
  export function getTileImageSource(key: string, url: string): Promise<string>
  export function removeTile(key: string): Promise<void>
}
