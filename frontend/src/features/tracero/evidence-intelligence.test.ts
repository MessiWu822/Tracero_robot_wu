import { describe, expect, it } from 'vitest'
import {
  buildEvidenceDigest,
  buildLaymanSummary,
  countSupportingEvidence,
} from './evidence-intelligence'
import type { TraceroEvidence, TraceroRun } from './types'

function evidence(
  id: string,
  type: string,
  extra: Record<string, unknown> = {}
) {
  return {
    evidence_id: id,
    type,
    title: '',
    source: '',
    excerpt: '',
    impact: '',
    ...extra,
  } as TraceroEvidence
}

describe('buildEvidenceDigest', () => {
  it('groups repeated evidence and prioritizes conclusion citations', () => {
    const runtime = [1, 2, 3, 4].map((value, index) =>
      evidence(`E-${index + 1}`, 'runtime', {
        topic: '/robot/speed',
        window: 'pre_5s',
        timestamp: index,
        data: value,
      })
    )
    const parameter = evidence('E-5', 'parameter', {
      name: 'speed_limit',
      value: 3,
    })
    const run = {
      run_id: 'run-test',
      conclusion: {
        fact: '速度在 E-4 达到峰值。',
        reasoning: '参数见 E-5。',
        suggestion: '检查速度限制。',
      },
      perspective_view: {
        perspective: 'dev',
        focus: '开发定位',
        conclusion: {
          fact: '速度在 E-4 达到峰值。',
          reasoning: '参数见 E-5。',
          suggestion: '检查速度限制。',
        },
        evidence: [...runtime, parameter],
        evidence_ids: ['E-1', 'E-2', 'E-3', 'E-4', 'E-5'],
        reasoning_rounds: [],
        evidence_by_type: { runtime, parameter: [parameter] },
      },
    } as unknown as TraceroRun

    const digest = buildEvidenceDigest(run)

    expect(digest.rawEvidence).toHaveLength(5)
    expect(digest.groups).toHaveLength(2)
    expect(digest.groups[0]?.total).toBe(4)
    expect(digest.keyEvidence.map((item) => item.id)).toEqual(
      expect.arrayContaining(['E-4', 'E-5'])
    )
  })

  it('keeps unknown evidence visible', () => {
    const item = evidence('X-1', 'future_sensor', { content: 'new format' })
    const run = {
      run_id: 'run-unknown',
      conclusion: { fact: '', reasoning: '', suggestion: '' },
      evidence: [item],
    } as unknown as TraceroRun

    const digest = buildEvidenceDigest(run)

    expect(digest.rawEvidence[0]).toMatchObject({
      id: 'X-1',
      kind: 'unknown',
    })
  })

  it('reduces hundreds of samples without discarding raw evidence', () => {
    const runtime = Array.from({ length: 360 }, (_, index) =>
      evidence(`E-${index + 1}`, 'runtime', {
        topic: `/robot/topic-${index % 3}`,
        window: index < 180 ? 'pre' : 'post',
        timestamp: index,
        data: index,
      })
    )
    const run = {
      run_id: 'run-large',
      conclusion: {
        fact: '关键变化见 E-360。',
        reasoning: '',
        suggestion: '',
      },
      perspective_view: {
        perspective: 'dev',
        focus: '大批量证据',
        conclusion: {
          fact: '关键变化见 E-360。',
          reasoning: '',
          suggestion: '',
        },
        evidence: runtime,
        evidence_ids: runtime.map((item) => item.evidence_id),
        reasoning_rounds: [],
        evidence_by_type: { runtime },
      },
    } as unknown as TraceroRun

    const digest = buildEvidenceDigest(run)

    expect(digest.rawEvidence).toHaveLength(360)
    expect(digest.groups).toHaveLength(6)
    expect(digest.keyEvidence.length).toBeLessThanOrEqual(20)
    expect(digest.keyEvidence.some((item) => item.id === 'E-360')).toBe(true)
  })
})

describe('buildLaymanSummary', () => {
  it('summarizes normal safety-triggered behavior in plain language', () => {
    const run = {
      run_id: 'run-plain',
      conclusion: {
        fact: '前方障碍物进入 0.65m 安全阈值 [E-01]',
        reasoning: '系统正常触发减速避障（非故障） [E-02]',
        suggestion: '评估 scan_threshold 是否过保守 [E-03]',
      },
    } as TraceroRun

    expect(buildLaymanSummary(run)).toContain('不是系统坏了')
  })
})

describe('countSupportingEvidence', () => {
  it('counts cited evidence ids when they are present', () => {
    const run = {
      run_id: 'run-count',
      conclusion: {
        fact: '见 E-01',
        reasoning: '见 E-02',
        suggestion: '见 E-03',
      },
    } as TraceroRun

    expect(countSupportingEvidence(run)).toBe(3)
  })
})
