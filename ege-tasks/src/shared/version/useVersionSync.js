import { useEffect, useRef } from 'react'
import { RELEASE_ID } from './buildInfo'

const DEFAULT_INTERVAL_MS = 3 * 60 * 1000

export function useVersionSync(onUpdate, intervalMs = DEFAULT_INTERVAL_MS) {
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (typeof onUpdate !== 'function') return undefined

    let timerId
    let cancelled = false

    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        if (!payload?.releaseId) return
        if (payload.releaseId === RELEASE_ID) return
        if (notifiedRef.current || cancelled) return

        notifiedRef.current = true
        onUpdate(payload)
      } catch {
        // No-op: version endpoint can be absent in local/dev environments.
      }
    }

    checkVersion()
    timerId = window.setInterval(checkVersion, intervalMs)

    return () => {
      cancelled = true
      if (timerId) window.clearInterval(timerId)
    }
  }, [intervalMs, onUpdate])
}
