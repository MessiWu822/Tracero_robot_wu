import { describe, expect, it } from 'vitest'
import {
  findDuplicateEventIds,
  removeSeededMockHistory,
  type EventHistoryRecord,
} from './event-history-store'
import { mockRuns } from './mock-data'

describe('removeSeededMockHistory', () => {
  it('removes the built-in demo runs from persisted live history', () => {
    const demoRecords: EventHistoryRecord[] = mockRuns.map((run) => ({
      run_id: run.run_id,
      event_type: run.event_type,
      trigger_time: run.trigger_time,
      status: run.status,
      summary: run.summary,
      robot: run.robot,
    }))
    const liveRun: EventHistoryRecord = {
      run_id: 'run-obstacle-live',
      event_type: '检测到障碍物',
      trigger_time: '12:00:00',
      status: 'done',
      summary: '真实 Agent 障碍事件',
      robot: 'robot_001',
    }

    expect(removeSeededMockHistory([...demoRecords, liveRun])).toEqual([
      liveRun,
    ])
  })
})

describe('findDuplicateEventIds', () => {
  it('only flags stable event ids that map to multiple runs', () => {
    const records: EventHistoryRecord[] = [
      {
        run_id: 'run-1',
        event_id: 'event-duplicate',
        event_type: '导航停滞',
        trigger_time: '12:00:00',
        status: 'done',
        summary: '完成',
        robot: 'robot_001',
      },
      {
        run_id: 'run-2',
        event_id: 'event-duplicate',
        event_type: '导航停滞',
        trigger_time: '12:00:01',
        status: 'failed',
        summary: '失败',
        robot: 'robot_001',
      },
      {
        run_id: 'run-3',
        event_id: 'event-unique',
        event_type: '检测到障碍物',
        trigger_time: '12:01:00',
        status: 'done',
        summary: '完成',
        robot: 'robot_002',
      },
    ]

    expect(findDuplicateEventIds(records)).toEqual(new Set(['event-duplicate']))
  })
})
