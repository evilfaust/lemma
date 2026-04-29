import { useEffect, useRef } from 'react'
import { notification, Button } from 'antd'
import { RELEASE_ID } from './buildInfo'

const INTERVAL_MS = 5 * 60 * 1000

export function useVersionSync() {
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV) return

    const check = async () => {
      if (notifiedRef.current) return
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const { releaseId, version } = await res.json()
        if (!releaseId || releaseId === RELEASE_ID) return
        notifiedRef.current = true
        notification.info({
          message: 'Доступно обновление',
          description: `Развёрнута версия ${version}. Обновите страницу, чтобы получить последние изменения.`,
          duration: 0,
          placement: 'bottomRight',
          btn: (
            <Button type="primary" size="small" onClick={() => window.location.reload()}>
              Обновить
            </Button>
          ),
        })
      } catch {
        // version.json может отсутствовать локально
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }

    check()
    const timerId = setInterval(check, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
