import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { listRunHistory } from './api'
import { mockRuns, type RunStatus } from './mock-data'

export type EventHistoryRecord = {
  run_id: string
  event_id?: string | null
  event_type: string
  trigger_time: string
  event_time_iso?: string
  status: RunStatus
  summary: string
  robot: string
}

type EventHistoryState = {
  records: EventHistoryRecord[]
  syncBackendRuns: () => Promise<void>
}

type PersistedHistoryRecord = EventHistoryRecord & {
  trigger_source?: string
}

const mockHistoryRecords: EventHistoryRecord[] = mockRuns.map((run) => ({
  run_id: run.run_id,
  event_type: run.event_type,
  trigger_time: run.trigger_time,
  status: run.status,
  summary: run.summary,
  robot: run.robot,
}))

const useMockHistory = import.meta.env.VITE_TRACERO_USE_MOCK === 'true'
const initialRecords = useMockHistory ? mockHistoryRecords : []
let latestHistoryRequest = 0

function recordIdentity(record: EventHistoryRecord) {
  return JSON.stringify([
    record.run_id,
    record.event_type,
    record.trigger_time,
    record.status,
    record.summary,
    record.robot,
  ])
}

const mockRecordIdentities = new Set(mockHistoryRecords.map(recordIdentity))

export function removeSeededMockHistory(records: EventHistoryRecord[]) {
  return records.filter(
    (record) => !mockRecordIdentities.has(recordIdentity(record))
  )
}

export function findDuplicateEventIds(records: EventHistoryRecord[]) {
  const counts = new Map<string, number>()
  records.forEach((record) => {
    if (record.event_id) {
      counts.set(record.event_id, (counts.get(record.event_id) ?? 0) + 1)
    }
  })

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([eventId]) => eventId)
  )
}

function normalizeEventHistory(records: PersistedHistoryRecord[]) {
  const agentRecords = records.filter(
    (record) =>
      record.trigger_source !== 'user_question' &&
      !record.run_id.startsWith('run_question_')
  )

  return useMockHistory ? agentRecords : removeSeededMockHistory(agentRecords)
}

export const useEventHistoryStore = create<EventHistoryState>()(
  persist(
    (set) => ({
      records: initialRecords,
      syncBackendRuns: async () => {
        const requestId = ++latestHistoryRequest
        const backendRecords = await listRunHistory()
        if (requestId !== latestHistoryRequest) return
        set({ records: normalizeEventHistory(backendRecords) })
      },
    }),
    {
      name: 'tracero-event-history',
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<EventHistoryState>
        return {
          ...currentState,
          records: normalizeEventHistory(
            (persisted.records ??
              currentState.records) as PersistedHistoryRecord[]
          ),
        }
      },
    }
  )
)
