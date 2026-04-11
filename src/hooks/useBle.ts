import { useState, useEffect, useRef, useCallback } from 'react'
import { db, type SavedDevice } from '../db'
import {
  type BleDeviceType,
  type RadarThreat,
  BLE_DEVICE_CONFIGS,
  BATTERY_SERVICE,
  BATTERY_LEVEL_CHAR,
  parseRadarData,
} from '../lib/ble'

export interface ConnectedDevice {
  device: BluetoothDevice
  server: BluetoothRemoteGATTServer
  type: BleDeviceType
  name: string
}

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAYS = [1000, 2000, 4000]

export function useBle() {
  const [connectedDevices, setConnectedDevices] = useState<Map<string, ConnectedDevice>>(new Map())
  const [radarData, setRadarData] = useState<RadarThreat[]>([])
  const [batteryLevels, setBatteryLevels] = useState<Map<string, number>>(new Map())

  const reconnectAttempts = useRef<Map<string, number>>(new Map())
  const reconnectTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pausedRef = useRef(false)
  const mountedRef = useRef(true)
  const connectDeviceRef = useRef<(device: BluetoothDevice, type: BleDeviceType) => Promise<boolean>>(
    () => Promise.resolve(false),
  )

  const bleAvailable = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const cleanupDevice = useCallback((deviceId: string) => {
    const timer = reconnectTimers.current.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      reconnectTimers.current.delete(deviceId)
    }
    reconnectAttempts.current.delete(deviceId)

    setConnectedDevices((prev) => {
      const next = new Map(prev)
      const entry = next.get(deviceId)
      if (entry?.server.connected) {
        entry.server.disconnect()
      }
      next.delete(deviceId)
      return next
    })
  }, [])

  const subscribeToCharacteristics = useCallback(
    async (device: BluetoothDevice, server: BluetoothRemoteGATTServer, type: BleDeviceType) => {
      const config = BLE_DEVICE_CONFIGS[type]

      // Read battery level
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE)
        const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL_CHAR)
        const batteryValue = await batteryChar.readValue()
        const level = batteryValue.getUint8(0)
        setBatteryLevels((prev) => new Map(prev).set(device.id, level))

        // Subscribe to battery updates
        await batteryChar.startNotifications()
        batteryChar.addEventListener('characteristicvaluechanged', ((e: Event) => {
          const target = e.target as BluetoothRemoteGATTCharacteristic
          if (!target.value) return
          const lvl = target.value.getUint8(0)
          setBatteryLevels((prev) => new Map(prev).set(device.id, lvl))
        }) as EventListener)
      } catch {
        // Battery service may not be available on all devices
      }

      // Subscribe to device-specific data
      try {
        const dataService = await server.getPrimaryService(config.dataCharacteristic.service)

        // Try configured characteristic first, fall back to first notifiable one
        let dataChar: BluetoothRemoteGATTCharacteristic | null = null
        try {
          dataChar = await dataService.getCharacteristic(config.dataCharacteristic.characteristic)
        } catch {
          const allChars = await dataService.getCharacteristics()
          const notifiable = allChars.find((c) => c.properties.notify)
          if (notifiable) {
            console.log(`[BLE] Configured characteristic not found, using fallback: ${notifiable.uuid}`)
            dataChar = notifiable
          }
        }

        if (dataChar) {
          console.log(`[BLE] Subscribing to characteristic: ${dataChar.uuid}`)
          await dataChar.startNotifications()
          console.log('[BLE] Notifications started successfully')
          dataChar.addEventListener('characteristicvaluechanged', ((e: Event) => {
            const target = e.target as BluetoothRemoteGATTCharacteristic
            if (!target.value) {
              console.log('[BLE] Received notification with no value')
              return
            }
            // Log raw bytes
            const bytes = new Uint8Array(target.value.buffer)
            if (bytes.length > 1) console.log(`[BLE] Raw data (${bytes.length} bytes):`, Array.from(bytes)) // Process data if there are multiple bytes — single-byte notifications may just be status updates
            if (pausedRef.current) return
            if (type === 'radar') {
              const threats = parseRadarData(target.value)
              if (threats.length > 0) {
                console.log('[BLE] Parsed threats:', threats)
              }
              setRadarData(threats)
            }
          }) as EventListener)
        } else {
          console.warn('[BLE] No notifiable characteristic found on radar service')
        }
      } catch (err) {
        console.error(`Failed to subscribe to ${config.label} data:`, err)
      }
    },
    [],
  )

  const connectDevice = useCallback(
    async (device: BluetoothDevice, type: BleDeviceType): Promise<boolean> => {
      try {
        const config = BLE_DEVICE_CONFIGS[type]
        console.log(`[BLE] Connecting to ${device.name ?? device.id} (${type})...`)
        const server = await device.gatt!.connect()
        console.log('[BLE] GATT server connected')

        const entry: ConnectedDevice = {
          device,
          server,
          type,
          name: device.name ?? config.label,
        }

        setConnectedDevices((prev) => new Map(prev).set(device.id, entry))
        reconnectAttempts.current.set(device.id, 0)

        console.log('[BLE] Subscribing to characteristics...')
        await subscribeToCharacteristics(device, server, type)
        console.log('[BLE] Subscription complete')

        // Persist to DB
        await db.devices.put({
          id: device.id,
          name: device.name ?? config.label,
          type,
          lastConnected: new Date(),
        })

        // Handle disconnection
        device.addEventListener('gattserverdisconnected', () => {
          if (!mountedRef.current) return
          setConnectedDevices((prev) => {
            const next = new Map(prev)
            next.delete(device.id)
            return next
          })
          if (type === 'radar') setRadarData([])
          setBatteryLevels((prev) => {
            const next = new Map(prev)
            next.delete(device.id)
            return next
          })

          // Auto-reconnect via ref to avoid circular dependency
          const attempts = reconnectAttempts.current.get(device.id) ?? 0
          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAYS[attempts] ?? RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1]
            reconnectAttempts.current.set(device.id, attempts + 1)
            const timer = setTimeout(() => {
              if (mountedRef.current) {
                connectDeviceRef.current(device, type)
              }
            }, delay)
            reconnectTimers.current.set(device.id, timer)
          }
        })

        return true
      } catch (err) {
        console.error('BLE connect failed:', err)
        return false
      }
    },
    [subscribeToCharacteristics],
  )

  // Keep ref in sync
  useEffect(() => {
    connectDeviceRef.current = connectDevice
  }, [connectDevice])

  const requestDevice = useCallback(
    async (type: BleDeviceType) => {
      if (!bleAvailable) return

      const config = BLE_DEVICE_CONFIGS[type]

      // One device per type — check if already connected
      for (const d of connectedDevices.values()) {
        if (d.type === type) return
      }

      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: config.serviceUuids },
            { namePrefix: config.namePrefix },
          ],
          optionalServices: [BATTERY_SERVICE],
        })

        await connectDevice(device, type)
      } catch (err) {
        // User cancelled the picker or other error
        if ((err as Error).name !== 'NotFoundError') {
          console.error('BLE request failed:', err)
        }
      }
    },
    [bleAvailable, connectedDevices, connectDevice],
  )

  const forgetDevice = useCallback(
    async (deviceId: string) => {
      const entry = connectedDevices.get(deviceId)
      if (entry?.type === 'radar') setRadarData([])

      cleanupDevice(deviceId)
      setBatteryLevels((prev) => {
        const next = new Map(prev)
        next.delete(deviceId)
        return next
      })
      await db.devices.delete(deviceId)
    },
    [connectedDevices, cleanupDevice],
  )

  // Auto-reconnect saved devices on mount
  useEffect(() => {
    if (!bleAvailable) return

    async function tryReconnect() {
      try {
        const savedDevices: SavedDevice[] = await db.devices.toArray()
        if (savedDevices.length === 0) return

        // getDevices() is not available in all browsers
        if (!navigator.bluetooth.getDevices) return
        const knownDevices = await navigator.bluetooth.getDevices()

        for (const saved of savedDevices) {
          const device = knownDevices.find((d: BluetoothDevice) => d.id === saved.id)
          if (device) {
            connectDeviceRef.current(device, saved.type)
          }
        }
      } catch {
        // getDevices not supported or permission denied — silent fail
      }
    }

    tryReconnect()
  }, [bleAvailable])

  // Pause data processing on visibility change
  useEffect(() => {
    function handleVisibility() {
      pausedRef.current = document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    const timers = reconnectTimers.current
    return () => {
      mountedRef.current = false
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  return {
    bleAvailable,
    connectedDevices,
    radarData,
    batteryLevels,
    requestDevice,
    forgetDevice,
  }
}
