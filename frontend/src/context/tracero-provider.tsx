import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getCurrentRun } from '@/features/tracero/api'
import type {
  AgentPushStatus,
  DeveloperTab,
  TraceroRun,
  UserRole,
} from '@/features/tracero/types'
import { TraceroContext } from './tracero-context'

const CURRENT_RUN_REFRESH_MS = 2_000
const NO_RUN_MESSAGE = '后端暂无 Agent 推理记录'

type TraceroProviderProps = {
  children: ReactNode
  initialRole?: UserRole
  initialLocationId?: string
  initialDeveloperTab?: DeveloperTab
}

function runPushStatus(run: TraceroRun): AgentPushStatus {
  if (run.status === 'reasoning') return 'reasoning'
  if (run.status === 'done') return 'done'
  return 'failed'
}

export function TraceroProvider({
  children,
  initialRole = 'general',
  initialLocationId,
  initialDeveloperTab = 'code',
}: TraceroProviderProps) {
  const [role, setRole] = useState<UserRole>(initialRole)
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >(initialLocationId)
  const [developerTab, setDeveloperTab] =
    useState<DeveloperTab>(initialDeveloperTab)
  const [currentRun, setCurrentRun] = useState<TraceroRun | null>(null)
  const [pushStatus, setPushStatus] = useState<AgentPushStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isLoadingCurrentRun, setIsLoadingCurrentRun] = useState(true)
  const latestCurrentRunRequest = useRef(0)

  useEffect(() => {
    if (initialRole !== undefined) setRole(initialRole)
  }, [initialRole])

  const refreshCurrentRun = useCallback(async (showLoading = false) => {
    const requestId = ++latestCurrentRunRequest.current
    if (showLoading) setIsLoadingCurrentRun(true)

    try {
      const run = await getCurrentRun(role)
      if (requestId !== latestCurrentRunRequest.current) return
      setCurrentRun(run)
      setPushStatus(runPushStatus(run))
      setError(null)
    } catch (error) {
      if (requestId !== latestCurrentRunRequest.current) return
      const message =
        error instanceof Error ? error.message : '当前推理事件加载失败'

      if (message === NO_RUN_MESSAGE) {
        setCurrentRun(null)
        setPushStatus('idle')
        setError(null)
      } else {
        setPushStatus('failed')
        setError(message)
      }
    } finally {
      if (showLoading && requestId === latestCurrentRunRequest.current) {
        setIsLoadingCurrentRun(false)
      }
    }
  }, [role])

  useEffect(() => {
    void refreshCurrentRun(true)
  }, [role, refreshCurrentRun])

  const loadCurrentRun = useCallback(
    () => refreshCurrentRun(true),
    [refreshCurrentRun]
  )

  useEffect(() => {
    let stopped = false
    let timeoutId: number | undefined

    const poll = async (showLoading = false) => {
      await refreshCurrentRun(showLoading)
      if (!stopped) {
        timeoutId = window.setTimeout(() => {
          void poll()
        }, CURRENT_RUN_REFRESH_MS)
      }
    }

    void poll(true)

    return () => {
      stopped = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [refreshCurrentRun, role])

  const value = useMemo(
    () => ({
      role,
      setRole,
      selectedLocationId,
      setSelectedLocationId,
      developerTab,
      setDeveloperTab,
      currentRun,
      pushStatus,
      error,
      isLoadingCurrentRun,
      loadCurrentRun,
    }),
    [
      role,
      selectedLocationId,
      developerTab,
      currentRun,
      pushStatus,
      error,
      isLoadingCurrentRun,
      loadCurrentRun,
    ]
  )

  return (
    <TraceroContext.Provider value={value}>{children}</TraceroContext.Provider>
  )
}

