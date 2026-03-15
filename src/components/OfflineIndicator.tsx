import type { CacheStatus } from '../hooks/useTileCache'

interface OfflineIndicatorProps {
  status: CacheStatus
  progress: { done: number; total: number }
  onCache: () => void
}

export function OfflineIndicator({ status, progress, onCache }: OfflineIndicatorProps) {
  return (
    <div className="offline-indicator">
      {status === 'idle' && (
        <button onClick={onCache} className="cache-btn">
          Save for offline
        </button>
      )}
      {status === 'downloading' && (
        <span className="cache-status downloading">
          Caching tiles... {progress.done}/{progress.total}
        </span>
      )}
      {status === 'cached' && (
        <span className="cache-status cached">Available offline</span>
      )}
      {status === 'error' && (
        <button onClick={onCache} className="cache-btn error">
          Retry cache
        </button>
      )}
    </div>
  )
}
