import type { CacheStatus } from '../hooks/useTileCache'

interface OfflineIndicatorProps {
  status: CacheStatus
  progress: { done: number; total: number }
  onRetry: () => void
}

export function OfflineIndicator({ status, progress, onRetry }: OfflineIndicatorProps) {
  return (
    <div className="offline-indicator">
      {status === 'idle' && (
        <span className="cache-status downloading">Preparing cache...</span>
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
        <button onClick={onRetry} className="cache-btn error">
          Retry cache
        </button>
      )}
    </div>
  )
}
