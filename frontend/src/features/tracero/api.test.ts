import { describe, expect, it } from 'vitest'
import {
  buildOverviewQuestionPayload,
  mapRunDetailSnapshot,
  mapRunHistoryItem,
} from './api'

describe('buildOverviewQuestionPayload', () => {
  it('creates a user-question request without using the Agent event path', () => {
    expect(
      buildOverviewQuestionPayload({
        question: '机器人刚才为什么左右摇摆？',
        robot: 'robot_001',
        occurredAt: '2026-08-23T09:59:00+08:00',
      })
    ).toEqual({
      evidence_type: 'user_question',
      evidence: [
        {
          evidence_id: 'Q-01',
          type: 'log',
          robot_id: 'robot_001',
          occurred_at: '2026-08-23T09:59:00+08:00',
          content: '用户在 Tracero 总览页提问：机器人刚才为什么左右摇摆？',
        },
      ],
    })
  })
})

describe('askRunQuestion', () => {
  it('uses the run-scoped follow-up endpoint', async () => {
    const originalFetch = globalThis.fetch
    const requests: Array<{ url: string; body: string }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({
        url: String(input),
        body: String(init?.body ?? ''),
      })
      return new Response(
        JSON.stringify({
          answer: '根据证据，最大角速度为 0.846 rad/s [E-342]。',
          content: '根据证据，最大角速度为 0.846 rad/s [E-342]。',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    try {
      const { askRunQuestion } = await import('./api')
      const answer = await askRunQuestion(
        { run_id: 'run-angle-001' },
        '小车运行的角速度峰值是多少'
      )

      expect(answer).toContain('0.846 rad/s')
      expect(requests[0]?.url).toContain('/api/runs/run-angle-001/follow-up')
      expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
        question: '小车运行的角速度峰值是多少',
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('mapRunHistoryItem', () => {
  it('maps an Agent obstacle event into the reasoning state', () => {
    const run = mapRunHistoryItem({
      run_id: 'run-obstacle',
      event_id: 'event-obstacle-001',
      evidence_type: 'obstacle_detected',
      trigger_time: 1_787_318_400,
      robot_id: 'robot_001',
      status: 'received',
      progress: '正在构建障碍事件证据',
      created_at: '2026-08-21T12:00:00.000Z',
    })

    expect(run).toMatchObject({
      run_id: 'run-obstacle',
      event_id: 'event-obstacle-001',
      event_type: '检测到障碍物',
      status: 'reasoning',
      summary: '正在构建障碍事件证据',
      robot: 'robot_001',
    })
  })

  it('normalizes completed navigation events from the backend', () => {
    const run = mapRunHistoryItem({
      run_id: 'run-navigation-stuck',
      evidence_type: 'navigation_stuck',
      trigger_time: 1_787_318_400,
      robot_id: 'robot_002',
      status: 'completed',
      progress: 'DeepSeek 推理完成',
      created_at: '2026-08-21T12:00:00.000Z',
    })

    expect(run).toMatchObject({
      event_type: '导航停滞',
      status: 'done',
      summary: 'DeepSeek 推理完成',
    })
  })
})

describe('mapRunDetailSnapshot', () => {
  it('shows Agent evidence before reasoning completes', () => {
    const run = mapRunDetailSnapshot({
      run_id: 'run-obstacle-live',
      event_id: 'event-obstacle-live-001',
      evidence_type: 'obstacle_detected',
      trigger_time: 1_787_318_400,
      robot_id: 'robot_001',
      status: 'reasoning',
      progress: '正在关联障碍物前后的导航证据',
      verified: false,
      created_at: '2026-08-21T12:00:00.000Z',
      evidence: [
        {
          evidence_id: 'obstacle-1',
          type: 'log',
          title: '障碍物检测',
          source: '/scan',
          content: 'min_range=0.28',
          impact: '小车前方安全距离内检测到障碍物',
        },
      ],
    })

    expect(run).toMatchObject({
      run_id: 'run-obstacle-live',
      event_id: 'event-obstacle-live-001',
      event_type: '检测到障碍物',
      status: 'reasoning',
      robot: 'robot_001',
    })
    expect(run.evidence).toHaveLength(1)
    expect(run.conclusion.reasoning).toContain('正在关联障碍物前后的导航证据')
    expect(run.data_provenance?.conclusion).toBe('unavailable')
    expect(run.timeline?.[run.timeline.length - 1]?.title).toBe('推理处理中')
  })

  it('maps a verified backend output to the visible conclusion', () => {
    const run = mapRunDetailSnapshot({
      run_id: 'run-obstacle-done',
      evidence_type: 'obstacle_detected',
      trigger_time: 1_787_318_400,
      robot_id: 'robot_001',
      status: 'done',
      progress: '推理完成',
      verified: true,
      created_at: '2026-08-21T12:00:03.000Z',
      output: [
        '【事实】激光雷达检测到前方障碍物 [E-01]',
        '【推理】局部路径被阻断，小车触发安全停车 [E-01]',
        '【建议】清理障碍物后重新规划路径 [E-01]',
      ].join('\n'),
      evidence: [
        {
          evidence_id: 'E-01',
          type: 'log',
          source: '/scan',
          content: 'min_range=0.28',
        },
      ],
    })

    expect(run.status).toBe('done')
    expect(run.conclusion).toEqual({
      fact: '激光雷达检测到前方障碍物 [E-01]',
      reasoning: '局部路径被阻断，小车触发安全停车 [E-01]',
      suggestion: '清理障碍物后重新规划路径 [E-01]',
    })
    expect(run.data_provenance?.conclusion).toBe('backend')
  })

  it('links round evidence_ids to the run-level evidence payload', () => {
    const run = mapRunDetailSnapshot({
      run_id: 'run-round-evidence',
      evidence_type: 'obstacle_near',
      trigger_time: 1_787_318_400,
      robot_id: 'robot_001',
      status: 'reasoning',
      progress: '正在推理',
      verified: false,
      created_at: '2026-08-21T12:00:00.000Z',
      evidence: [
        {
          evidence_id: 'LOG-001',
          type: 'log',
          title: 'ROS 导航日志',
          source: '/rosout',
          content: 'controller timeout',
        },
      ],
      reasoning_rounds: [
        {
          round: 1,
          title: '异常事实确认',
          reasoning: '控制器出现超时。',
          tool_calls: ['query_logs'],
          evidence_ids: ['LOG-001'],
        },
      ],
    })

    expect(run.reasoning_rounds?.[0].evidence).toHaveLength(1)
    expect(run.reasoning_rounds?.[0].evidence?.[0]).toMatchObject({
      evidence_id: 'LOG-001',
      title: 'ROS 导航日志',
    })
  })
})
