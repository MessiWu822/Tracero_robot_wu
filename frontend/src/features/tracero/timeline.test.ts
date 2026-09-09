import { describe, expect, it } from 'vitest'
import { buildRunTimeline } from './timeline'

describe('buildRunTimeline', () => {
  it('derives an obstacle timeline from Agent data and evidence', () => {
    const result = buildRunTimeline({
      created_at: '2026-08-21T06:06:03.000Z',
      trigger_time: 1787292360,
      progress: null,
      status: 'done',
      raw_event: {
        window: {
          at: [
            {
              topic: '/scan',
              timestamp: 1787292360,
              data: { min_range: 0.28 },
            },
          ],
        },
      },
      evidence: [
        {
          evidence_id: 'E-01',
          title: '障碍物距离',
          content: '前方最近障碍物距离为 0.28m。',
        },
      ],
    })

    expect(result.source).toBe('derived')
    expect(result.items.map((item) => item.title)).toEqual([
      '采集 /scan',
      '纳入证据 E-01：障碍物距离',
      '推理结果生成',
    ])
    expect(result.items[result.items.length - 1]?.level).toBe('success')
  })

  it('marks the derived final node as running before completion', () => {
    const result = buildRunTimeline({
      created_at: '2026-08-21T06:06:03.000Z',
      trigger_time: 1787292360,
      progress: '正在调用模型',
      status: 'reasoning',
    })

    expect(result.items[result.items.length - 1]).toMatchObject({
      title: '推理处理中',
      description: '正在调用模型',
      level: 'info',
    })
  })

  it('prefers an explicit backend timeline when one is available', () => {
    const result = buildRunTimeline({
      created_at: '2026-08-21T06:06:03.000Z',
      trigger_time: null,
      progress: null,
      status: 'done',
      timeline: [
        {
          time: '14:06:01',
          title: '分析传感器数据',
          description: '后端时间线节点',
          level: 'warning',
        },
      ],
    })

    expect(result.source).toBe('backend')
    expect(result.items[0]?.title).toBe('分析传感器数据')
  })
})
