import { BLE_DEVICE_CONFIGS, type BleDeviceType } from '../lib/ble'
import type { ConnectedDevice } from '../hooks/useBle'

interface BleSettingsDrawerProps {
  open: boolean
  onClose: () => void
  connectedDevices: Map<string, ConnectedDevice>
  batteryLevels: Map<string, number>
  onRequestDevice: (type: BleDeviceType) => void
  onForgetDevice: (deviceId: string) => void
}

const DEVICE_TYPES = Object.keys(BLE_DEVICE_CONFIGS) as BleDeviceType[]

export function BleSettingsDrawer({
  open,
  onClose,
  connectedDevices,
  batteryLevels,
  onRequestDevice,
  onForgetDevice,
}: BleSettingsDrawerProps) {
  // Find connected device for a given type
  function getConnectedForType(type: BleDeviceType) {
    for (const [id, device] of connectedDevices) {
      if (device.type === type) return { id, ...device }
    }
    return null
  }

  return (
    <>
      {open && <div className="ble-drawer-backdrop" onClick={onClose} />}
      <div className={`ble-drawer ${open ? 'open' : ''}`}>
        <div className="ble-drawer-header">
          <h2>Devices</h2>
          <button className="ble-drawer-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ble-drawer-body">
          {DEVICE_TYPES.map((type) => {
            const config = BLE_DEVICE_CONFIGS[type]
            const connected = getConnectedForType(type)

            return (
              <div key={type} className="ble-device-section">
                <h3 className="ble-device-type-label">{config.label}</h3>
                {connected ? (
                  <div className="ble-device-card">
                    <div className="ble-device-info">
                      <span className="ble-device-name">{connected.name}</span>
                      {batteryLevels.has(connected.id) && (
                        <span className="ble-battery">
                          {getBatteryIcon(batteryLevels.get(connected.id)!)}
                          {batteryLevels.get(connected.id)}%
                        </span>
                      )}
                    </div>
                    <span className="ble-status connected">Connected</span>
                    <button
                      className="ble-forget-btn"
                      onClick={() => onForgetDevice(connected.id)}
                    >
                      Forget
                    </button>
                  </div>
                ) : (
                  <button
                    className="ble-pair-btn"
                    onClick={() => onRequestDevice(type)}
                  >
                    Pair {config.label}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function getBatteryIcon(level: number) {
  const fill = level > 60 ? '#16a34a' : level > 20 ? '#f59e0b' : '#d32f2f'
  const barWidth = Math.max(2, (level / 100) * 12)
  return (
    <svg viewBox="0 0 20 12" width="20" height="12" className="ble-battery-icon">
      <rect x="0.5" y="0.5" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="17" y="3" width="2.5" height="6" rx="1" fill="currentColor" />
      <rect x="2" y="2" width={barWidth} height="8" rx="1" fill={fill} />
    </svg>
  )
}
