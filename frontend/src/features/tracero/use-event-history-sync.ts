import { useEffect } from 'react'
import { useEventHistoryStore } from './event-history-store'

const HISTORY_SYNC_INTERVAL_MS = 2_000

export function useEventHistorySync() {
  const syncBackendRuns = useEventHistoryStore((state) => state.syncBackendRuns)

  useEffect(() => {
    const sync = () => void syncBackendRuns().catch(() => undefined)
    sync()
    const intervalId = window.setInterval(sync, HISTORY_SYNC_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [syncBackendRuns])
}
