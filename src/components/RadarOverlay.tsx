import {
  type RadarThreat,
  MAX_RADAR_DISTANCE,
  RADAR_SPEED_SLOW,
  RADAR_SPEED_MODERATE,
} from '../lib/ble'

interface RadarOverlayProps {
  threats: RadarThreat[]
}

function getThreatLevel(threats: RadarThreat[]): 'none' | 'green' | 'orange' | 'red' {
  if (threats.length === 0) return 'none'
  // Use the closest threat's speed for color coding
  const closest = threats.reduce((a, b) => (a.distance < b.distance ? a : b))
  if (closest.speed <= RADAR_SPEED_SLOW) return 'green'
  if (closest.speed <= RADAR_SPEED_MODERATE) return 'orange'
  return 'red'
}

export function RadarOverlay({ threats }: RadarOverlayProps) {
  const level = getThreatLevel(threats)

  return (
    <div className="radar-overlay">
      <div className={`radar-column ${level !== 'none' ? `threat-${level}` : ''}`}>
        {/* Threat dots positioned by distance */}
        {threats.map((threat, i) => {
          const yPercent = Math.min((threat.distance / MAX_RADAR_DISTANCE) * 100, 100)
          return (
            <div
              key={i}
              className="radar-threat-dot"
              style={{ top: `${yPercent}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
