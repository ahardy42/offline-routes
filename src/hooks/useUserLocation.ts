import { useEffect, useRef, useState, useCallback } from 'react'

export type LocationMode = 'off' | 'locating' | 'showing' | 'following'

interface UserLocationState {
  mode: LocationMode
  position: [number, number] | null
  accuracy: number | null
  error: string | null
}

export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({
    mode: 'off',
    position: null,
    accuracy: null,
    error: null,
  })
  const watchIdRef = useRef<number | null>(null)
  const hasHadFirstFix = useRef(false)

  // Sync mode to ref via effect (not during render)
  const modeRef = useRef<LocationMode>('off')
  useEffect(() => {
    modeRef.current = state.mode
  }, [state.mode])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    hasHadFirstFix.current = false
  }, [])

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) return

    setState((s) => ({ ...s, mode: 'locating', error: null }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const position: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        hasHadFirstFix.current = true

        setState((s) => ({
          ...s,
          position,
          accuracy: pos.coords.accuracy,
          mode: s.mode === 'locating' ? 'showing' : s.mode,
          error: null,
        }))
      },
      (err) => {
        let message = 'Unable to get location'
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Location permission denied'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Location unavailable'
        } else if (err.code === err.TIMEOUT) {
          message = 'Location request timed out'
        }
        setState((s) => ({ ...s, mode: 'off', error: message }))
        stopWatch()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )
  }, [stopWatch])

  const handlePress = useCallback(() => {
    setState((s) => {
      switch (s.mode) {
        case 'off':
          // Will start watch after state update via effect
          return s
        case 'locating':
          return s
        case 'showing':
          return { ...s, mode: 'following' }
        case 'following':
          return { ...s, mode: 'showing' }
      }
    })
    // Start watch if currently off (read from ref which was synced before this handler fires)
    if (modeRef.current === 'off') {
      startWatch()
    }
  }, [startWatch])

  const handleLongPress = useCallback(() => {
    const currentMode = modeRef.current
    if (currentMode === 'off' || currentMode === 'locating') {
      startWatch()
    } else {
      stopWatch()
      setState({ mode: 'off', position: null, accuracy: null, error: null })
    }
  }, [startWatch, stopWatch])

  const stopFollowing = useCallback(() => {
    setState((s) => (s.mode === 'following' ? { ...s, mode: 'showing' } : s))
  }, [])

  // Handle page visibility changes
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        setState((s) => (s.mode === 'following' ? { ...s, mode: 'showing' } : s))
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return {
    mode: state.mode,
    position: state.position,
    accuracy: state.accuracy,
    error: state.error,
    handlePress,
    handleLongPress,
    stopFollowing,
  }
}
