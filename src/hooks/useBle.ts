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

interface DeviceListeners {
  disconnect: () => void
  batteryChange?: EventListener
  dataChange?: EventListener
  batteryChar?: BluetoothRemoteGATTCharacteristic
  dataChar?: BluetoothRemoteGATTCharacteristic
}

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAYS = [1000, 2000, 4000]

export function useBle() {
  const [connectedDevices, setConnectedDevices] = useState<Map<string, ConnectedDevice>>(new Map())
  const [radarData, setRadarData] = useState<RadarThreat[]>([])
  const [batteryLevels, setBatteryLevels] = useState<Map<string, number>>(new Map())

  const reconnectAttempts = useRef<Map<string, number>>(new Map())
  const reconnectTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const deviceListeners = useRef<Map<string, DeviceListeners>>(new Map())
  const pausedRef = useRef(false)
  const mountedRef = useRef(true)
  const connectDeviceRef = useRef<(device: BluetoothDevice, type: BleDeviceType) => Promise<boolean>>(
    () => Promise.resolve(false),
  )

  const bleAvailable = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const removeDeviceListeners = useCallback((deviceId: string, device: BluetoothDevice) => {
    const listeners = deviceListeners.current.get(deviceId)
    if (!listeners) return

    device.removeEventListener('gattserverdisconnected', listeners.disconnect)
    if (listeners.batteryChar && listeners.batteryChange) {
      listeners.batteryChar.removeEventListener('characteristicvaluechanged', listeners.batteryChange)
    }
    if (listeners.dataChar && listeners.dataChange) {
      listeners.dataChar.removeEventListener('characteristicvaluechanged', listeners.dataChange)
    }
    deviceListeners.current.delete(deviceId)
  }, [])

  const cleanupDevice = useCallback((deviceId: string, currentDevices: Map<string, ConnectedDevice>) => {
    const timer = reconnectTimers.current.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      reconnectTimers.current.delete(deviceId)
    }
    reconnectAttempts.current.delete(deviceId)

    const entry = currentDevices.get(deviceId)
    if (entry) {
      removeDeviceListeners(deviceId, entry.device)
      if (entry.server.connected) {
        entry.server.disconnect()
      }
    }

    setConnectedDevices((prev) => {
      const next = new Map(prev)
      next.delete(deviceId)
      return next
    })
  }, [removeDeviceListeners])

  const subscribeToCharacteristics = useCallback(
    async (device: BluetoothDevice, server: BluetoothRemoteGATTServer, type: BleDeviceType) => {
      const config = BLE_DEVICE_CONFIGS[type]
      const listeners: Partial<DeviceListeners> = {}

      // Read battery level
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE)
        const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL_CHAR)
        const batteryValue = await batteryChar.readValue()
        const level = batteryValue.getUint8(0)
        setBatteryLevels((prev) => new Map(prev).set(device.id, level))

        await batteryChar.startNotifications()
        const batteryHandler = ((e: Event) => {
          const target = e.target as BluetoothRemoteGATTCharacteristic
          if (!target.value) return
          setBatteryLevels((prev) => new Map(prev).set(device.id, target.value!.getUint8(0)))
        }) as EventListener
        batteryChar.addEventListener('characteristicvaluechanged', batteryHandler)
        listeners.batteryChar = batteryChar
        listeners.batteryChange = batteryHandler
      } catch {
        // Battery service may not be available on all devices
      }

      // Subscribe to device-specific data
      try {
        const dataService = await server.getPrimaryService(config.dataCharacteristic.service)

        let dataChar: BluetoothRemoteGATTCharacteristic | null = null
        try {
          dataChar = await dataService.getCharacteristic(config.dataCharacteristic.characteristic)
        } catch {
          const allChars = await dataService.getCharacteristics()
          const notifiable = allChars.find((c) => c.properties.notify)
          if (notifiable) dataChar = notifiable
        }

        if (dataChar) {
          await dataChar.startNotifications()
          const dataHandler = ((e: Event) => {
            const target = e.target as BluetoothRemoteGATTCharacteristic
            if (!target.value) return
            if (pausedRef.current) return
            if (type === 'radar') {
              setRadarData(parseRadarData(target.value))
            }
          }) as EventListener
          dataChar.addEventListener('characteristicvaluechanged', dataHandler)
          listeners.dataChar = dataChar
          listeners.dataChange = dataHandler
        }
      } catch (err) {
        console.error(`Failed to subscribe to ${config.label} data:`, err)
      }

      return listeners
    },
    [],
  )

  const connectDevice = useCallback(
    async (device: BluetoothDevice, type: BleDeviceType): Promise<boolean> => {
      try {
        const config = BLE_DEVICE_CONFIGS[type]

        // Clean up any existing listeners from a previous connection
        removeDeviceListeners(device.id, device)

        const server = await device.gatt!.connect()

        const entry: ConnectedDevice = {
          device,
          server,
          type,
          name: device.name ?? config.label,
        }

        setConnectedDevices((prev) => new Map(prev).set(device.id, entry))
        reconnectAttempts.current.set(device.id, 0)

        const charListeners = await subscribeToCharacteristics(device, server, type)

        // Persist to DB
        await db.devices.put({
          id: device.id,
          name: device.name ?? config.label,
          type,
          lastConnected: new Date(),
        })

        // Handle disconnection
        const disconnectHandler = () => {
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
        }

        device.addEventListener('gattserverdisconnected', disconnectHandler)

        // Store all listeners for cleanup
        deviceListeners.current.set(device.id, {
          disconnect: disconnectHandler,
          ...charListeners,
        })

        return true
      } catch (err) {
        console.error('BLE connect failed:', err)
        return false
      }
    },
    [subscribeToCharacteristics, removeDeviceListeners],
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

      cleanupDevice(deviceId, connectedDevices)
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
    const listeners = deviceListeners.current
    return () => {
      mountedRef.current = false
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      // Disconnect all GATT servers and remove listeners
      for (const [id, entry] of connectedDevices) {
        removeDeviceListeners(id, entry.device)
        if (entry.server.connected) {
          entry.server.disconnect()
        }
      }
      listeners.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
