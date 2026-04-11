// BLE device type registry — add new device types here

export type BleDeviceType = 'radar'

export interface BleDeviceConfig {
  label: string
  namePrefix: string
  serviceUuids: string[]
  dataCharacteristic: { service: string; characteristic: string }
}

export const BLE_DEVICE_CONFIGS: Record<BleDeviceType, BleDeviceConfig> = {
  radar: {
    label: 'Radar',
    // Varia advertises as "RTL#####" not "Varia" — filter by service UUID instead
    namePrefix: 'RTL',
    serviceUuids: ['6a4e3200-667b-11e3-949a-0800200c9a66'],
    dataCharacteristic: {
      service: '6a4e3200-667b-11e3-949a-0800200c9a66',
      characteristic: '6a4e3203-667b-11e3-949a-0800200c9a66',
    },
  },
}

export const BATTERY_SERVICE = 0x180f
export const BATTERY_LEVEL_CHAR = 0x2a19

// Max distance value from Varia (uint8 range)
export const MAX_RADAR_DISTANCE = 140

// Speed thresholds in Varia's relative units (observed range ~4-15)
export const RADAR_SPEED_SLOW = 8 // green
export const RADAR_SPEED_MODERATE = 12 // orange
// Above moderate → red

export interface RadarThreat {
  id: number
  distance: number // relative distance units (higher = farther, ~7m per unit, max ~140m)
  speed: number // relative approach speed units (higher = faster approach)
}

/**
 * Parse Garmin Varia radar characteristic value.
 *
 * Format (reverse-engineered from real RTL515 data):
 *   byte 0: header/sequence byte (not threat count)
 *   then 3 bytes per threat:
 *     byte 0: threat identifier/type
 *     byte 1: distance (relative units, decreases as vehicle approaches)
 *     byte 2: speed (relative units, higher = faster approach)
 *   threat count = (byteLength - 1) / 3
 */
export function parseRadarData(dataView: DataView): RadarThreat[] {
  if (dataView.byteLength < 4) return [] // need at least header + 1 threat (3 bytes)

  const threatCount = Math.floor((dataView.byteLength - 1) / 3)
  const threats: RadarThreat[] = []

  for (let i = 0; i < threatCount; i++) {
    const offset = 1 + i * 3
    threats.push({
      id: dataView.getUint8(offset),
      distance: dataView.getUint8(offset + 1),
      speed: dataView.getUint8(offset + 2),
    })
  }

  return threats
}
