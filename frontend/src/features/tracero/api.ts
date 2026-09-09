import { mockCurrentRun, mockRuns } from './mock-data'
import { buildRunTimeline } from './timeline'
import type { Perspective, PerspectiveView, ReasoningConclusion, TraceroEvidence, TraceroRun } from './types'

const API_BASE_URL = (import.meta.env.VITE_TRACERO_API_BASE_URL ?? '').replace(
  /\/$/,
  ''
)
const USE_MOCK = import.meta.env.VITE_TRACERO_USE_MOCK === 'true'

const endpoints = {
  runs: import.meta.env.VITE_TRACERO_RUNS_PATH ?? '/api/runs',
  reasoning:
    import.meta.env.VITE_TRACERO_QUESTION_REASONING_PATH ?? '/api/debug/reason',
}

type RunApiResponse = {
  run_id: string
  event_id?: string | null
  perspective?: Perspective
  perspective_view?: PerspectiveView
  available_perspectives?: Perspective[]
  evidence_type: string
  trigger_time: number | null
  robot_id: string | null
  status:
    | 'pending'
    | 'received'
    | 'processing'
    | 'reasoning'
    | 'completed'
    | 'done'
    | 'verification_failed'
    | 'failed'
  progress: string | null
  verified: boolean
  created_at: string
  evidence?: Array<Record<string, unknown>>
  output?: string
  errors?: string[]
  valid_evidence_ids?: string[]
  raw_event?: {
    event_type?: string
    window?: Record<string, Array<Record<string, unknown>>>
  }
  timeline?: Array<Record<string, unknown>>
  reasoning_rounds?: Array<{
    round: number
    title: string
    reasoning: string
    tool_calls?: string[]
    evidence_ids?: string[]
    evidence?: Array<Record<string, unknown>>
  }>
}

type RunsApiResponse = {
  runs: Array<
    Pick<
      RunApiResponse,
      | 'run_id'
      | 'event_id'
      | 'evidence_type'
      | 'trigger_time'
      | 'robot_id'
      | 'created_at'
      | 'status'
      | 'progress'
    >
  >
}

export type RunHistoryItem = {
  run_id: string
  event_id?: string | null
  perspective?: Perspective
  perspective_view?: PerspectiveView
  available_perspectives?: Perspective[]
  event_type: string
  trigger_time: string
  event_time_iso: string
  status: 'reasoning' | 'done' | 'failed'
  summary: string
  robot: string
}

function endpoint(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const responseText = await response.text()
    let detail = responseText
    try {
      const errorPayload = JSON.parse(responseText) as {
        detail?: string | { error_code?: string; message?: string }
      }
      if (typeof errorPayload.detail === 'string') {
        detail = errorPayload.detail
      } else if (errorPayload.detail) {
        detail = [errorPayload.detail.error_code, errorPayload.detail.message]
          .filter(Boolean)
          .join('：')
      }
    } catch {
      // Keep non-JSON responses so proxy and CORS failures remain diagnosable.
    }
    throw new Error(detail || `Tracero API 请求失败 (${response.status})`)
  }

  return response.json() as Promise<T>
}

export async function askRunQuestion(
  run: Pick<TraceroRun, 'run_id'>,
  question: string,
  perspective: Perspective = 'general'
): Promise<string> {
  if (USE_MOCK)
    return '已收到追问。当前结论显示该异常与局部路径阻塞及安全停车策略有关。'
  const response = await requestJson<{
    conclusion?: { fact?: string; reasoning?: string; suggestion?: string }
    answer?: string
    content?: string
    output?: string
    progress?: string
    evidence_ids?: string[]
  }>(`${endpoints.runs}/${encodeURIComponent(run.run_id)}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: question,
      context: { perspective },
    }),
  })
  const conclusion = response.conclusion
  return (
    [conclusion?.fact, conclusion?.reasoning, conclusion?.suggestion]
      .filter(Boolean)
      .join('\n') ||
    response.answer ||
    response.content ||
    response.output ||
    response.progress ||
    '后端未返回可显示的回答。'
  )
}

export type OverviewQuestionInput = {
  question: string
  robot: string
  occurredAt: string
}

export function buildOverviewQuestionPayload(input: OverviewQuestionInput) {
  return {
    evidence_type: 'user_question',
    evidence: [
      {
        evidence_id: 'Q-01',
        type: 'log',
        robot_id: input.robot,
        occurred_at: input.occurredAt,
        content: `用户在 Tracero 总览页提问：${input.question}`,
      },
    ],
  }
}

export async function askOverviewQuestion(
  input: OverviewQuestionInput
): Promise<string> {
  if (USE_MOCK) {
    return '已收到问题。当前为 Mock 模式，真实推理结果将在连接后端后显示。'
  }

  const response = await requestJson<{
    conclusion?: { fact?: string; reasoning?: string; suggestion?: string }
    output?: string
    progress?: string
  }>(endpoints.reasoning, {
    method: 'POST',
    body: JSON.stringify(buildOverviewQuestionPayload(input)),
  })
  const conclusion = response.conclusion

  return (
    [conclusion?.fact, conclusion?.reasoning, conclusion?.suggestion]
      .filter(Boolean)
      .join('\n') ||
    response.output ||
    response.progress ||
    '后端未返回可显示的回答。'
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function eventTypeLabel(eventType: string) {
  return (
    {
      navigation_failed: '导航失败',
      navigation_stuck: '导航停滞',
      obstacle_near: '障碍物过近',
      obstacle: '遇到障碍物',
      obstacle_detected: '检测到障碍物',
      obstacle_encountered: '遇到障碍物',
      collision: '碰撞事件',
      collision_detected: '检测到碰撞',
    }[eventType] ?? eventType
  )
}

function normalizeRunStatus(status: RunApiResponse['status']) {
  if (
    status === 'pending' ||
    status === 'received' ||
    status === 'processing' ||
    status === 'reasoning'
  ) {
    return 'reasoning' as const
  }
  if (status === 'completed' || status === 'done') return 'done' as const
  return 'failed' as const
}

function isAgentRun(run: Pick<RunApiResponse, 'evidence_type'>) {
  return (
    run.evidence_type !== 'user_question' &&
    run.evidence_type !== 'follow_up_question'
  )
}

function triggerTimeIso(
  response: Pick<RunApiResponse, 'trigger_time' | 'created_at'>
) {
  if (typeof response.trigger_time === 'number') {
    return new Date(response.trigger_time * 1000).toISOString()
  }
  return response.created_at
}

export function mapRunHistoryItem(
  run: RunsApiResponse['runs'][number]
): RunHistoryItem {
  const status = normalizeRunStatus(run.status)
  return {
    run_id: run.run_id,
    event_id: run.event_id,
    event_type: eventTypeLabel(run.evidence_type),
    trigger_time: formatTime(triggerTimeIso(run)),
    event_time_iso: triggerTimeIso(run),
    status,
    summary: run.progress ?? eventTypeLabel(run.evidence_type),
    robot: run.robot_id ?? 'unknown',
  }
}

export async function listRunHistory(): Promise<RunHistoryItem[]> {
  if (USE_MOCK) {
    return mockRuns.map((run) => ({
      run_id: run.run_id,
      event_type: run.event_type,
      trigger_time: run.trigger_time,
      event_time_iso: new Date().toISOString(),
      status: run.status,
      summary: run.summary,
      robot: run.robot,
    }))
  }

  const { runs } = await requestJson<RunsApiResponse>(endpoints.runs)
  return runs.filter(isAgentRun).map(mapRunHistoryItem)
}

function parseConclusion(output: string): ReasoningConclusion {
  const readSection = (section: string) => {
    const bracketed = new RegExp(
      `^(?:\\*\\*)?【${section}】(?:\\*\\*)?\\s*[:：]?\\s*(.+)$`
    )
    const plain = new RegExp(
      `^(?:\\*\\*)?${section}(?:\\*\\*)?\\s*[:：]\\s*(.+)$`
    )

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/^[-*]\s+/, '')
      const match = line.match(bracketed) ?? line.match(plain)
      if (match?.[1]?.trim()) return match[1].trim()
    }
    return undefined
  }

  const fact = readSection('事实')
  const reasoning = readSection('推理')
  const suggestion = readSection('建议')
  if (!fact || !reasoning || !suggestion) {
    throw new Error('后端推理结果缺少【事实】【推理】或【建议】')
  }
  return { fact, reasoning, suggestion }
}

function evidenceType(value: unknown): TraceroEvidence['type'] {
  if (value === 'code' || value === 'source_code') return 'code'
  if (value === 'metric') return 'metric'
  if (value === 'config' || value === 'parameter' || value === 'message_mapping') return 'config'
  return 'log'
}

function evidenceText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  return JSON.stringify(value) ?? String(value)
}

function mapEvidence(response: RunApiResponse): TraceroEvidence[] | undefined {
  if (!response.evidence?.length) return undefined

  return response.evidence.map((item, index) => {
    const evidenceId = evidenceText(item.evidence_id ?? item.id)
    const source = evidenceText(item.source ?? item.topic ?? item.path)
    const excerpt = evidenceText(
      item.excerpt ??
        item.content ??
        item.value ??
        item.data ??
        item.payload ??
        item.raw_data ??
        item.details
    )
    const impact = evidenceText(
      item.impact ?? item.description ?? item.summary ?? excerpt
    )
    return {
      evidence_id:
        evidenceId || response.valid_evidence_ids?.[index] || `E-${index + 1}`,
      type: evidenceType(item.type),
      title: evidenceText(item.title ?? item.name) || `证据 ${index + 1}`,
      source: source || '后端证据',
      excerpt,
      impact: impact || '后端未提供证据说明。',
    }
  })
}

function mergeMappedEvidence(groups: Array<TraceroEvidence[] | undefined>) {
  const merged = new Map<string, TraceroEvidence>()
  const quality = (item: TraceroEvidence) =>
    Number(Boolean(item.excerpt)) +
    Number(item.source !== '后端证据') +
    Number(item.impact !== '后端未提供证据说明。')
  groups.flatMap((group) => group ?? []).forEach((item) => {
    const existing = merged.get(item.evidence_id)
    if (!existing || quality(item) > quality(existing)) {
      merged.set(item.evidence_id, item)
    }
  })
  return merged.size ? [...merged.values()] : undefined
}

export function mapRunDetailSnapshot(response: RunApiResponse): TraceroRun {
  // Perspective responses keep filtered evidence under perspective_view.
  // Fall back to the legacy top-level field for older backend responses.
  const perspectiveEvidence = response.perspective_view?.evidence
  const normalizedPerspectiveEvidence = perspectiveEvidence?.length
    ? mapEvidence({ ...response, evidence: perspectiveEvidence as Array<Record<string, unknown>> })
    : undefined
  const evidenceByType = Object.values(
    response.perspective_view?.evidence_by_type ?? {}
  ).flat()
  const normalizedEvidenceByType = evidenceByType.length
    ? mapEvidence({
        ...response,
        evidence: evidenceByType as Array<Record<string, unknown>>,
      })
    : undefined
  const evidence = mergeMappedEvidence([
    normalizedPerspectiveEvidence,
    normalizedEvidenceByType,
    mapEvidence(response),
  ])
  const timeline = buildRunTimeline(response)
  const reasoningRounds = response.reasoning_rounds?.map((round) => {
    const roundEvidence = round.evidence?.map(
      (item, index) =>
        mapEvidence({ ...response, evidence: [item] })?.[0] ?? {
          evidence_id: round.evidence_ids?.[index] ?? 'E-' + (index + 1),
          type: evidenceType('log'),
          title: 'Evidence ' + (index + 1),
          source: 'Backend',
          excerpt: JSON.stringify(item),
          impact: JSON.stringify(item),
        }
    )

    // Some backend versions store only evidence_ids on each round. Resolve
    // those IDs against the Run-level evidence so the selected round remains
    // grounded in the actual logs, code, and telemetry returned by the API.
    const evidenceById = new Map(
      (evidence ?? []).map((item) => [item.evidence_id, item])
    )
    const linkedEvidence = (round.evidence_ids ?? [])
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((item): item is NonNullable<typeof evidence>[number] =>
        Boolean(item)
      )

    return {
      round: round.round,
      title: round.title,
      reasoning: round.reasoning || '',
      tool_calls: round.tool_calls ?? [],
      evidence_ids: round.evidence_ids ?? [],
      evidence: roundEvidence?.length ? roundEvidence : linkedEvidence,
    }
  })
  const hasConclusion = response.verified && Boolean(response.output)
  const backendStatus = normalizeRunStatus(response.status)
  const status =
    backendStatus === 'reasoning'
      ? 'reasoning'
      : hasConclusion
        ? 'done'
        : 'failed'
  const progress = response.progress ?? '后端正在处理 Agent 事件证据'
  const failure = response.errors?.join('；') || progress
  const conclusion = hasConclusion
    ? parseConclusion(response.output!)
    : status === 'failed'
      ? {
          fact: '本次推理未生成可验证的结论。',
          reasoning: failure,
          suggestion: '请检查 Agent 事件、证据构建和模型服务后重试。',
        }
      : {
          fact: evidence?.length
            ? `已接收并整理 ${evidence.length} 条 Agent 事件证据。`
            : '小车障碍事件已到达后端。',
          reasoning: progress,
          suggestion: '推理完成后，本区域会自动更新为后端真实结论。',
        }

  return {
    run_id: response.run_id,
    event_id: response.event_id,
    event_type: eventTypeLabel(response.evidence_type),
    trigger_time: formatTime(triggerTimeIso(response)),
    status,
    robot: response.robot_id ?? 'unknown',
    data_source: 'robot',
    timeline: timeline.items,
    timeline_source: timeline.source,
    reasoning_rounds: response.perspective_view?.reasoning_rounds?.map((round) => ({
      ...round,
      evidence: round.evidence?.length
        ? mapEvidence({ ...response, evidence: round.evidence as Array<Record<string, unknown>> })
        : undefined,
    })) ?? reasoningRounds,
    perspective: response.perspective,
    perspective_view: response.perspective_view,
    available_perspectives: response.available_perspectives,
    data_provenance: {
      event: 'backend',
      conclusion: hasConclusion ? 'backend' : 'unavailable',
      evidence: evidence ? 'backend' : 'unavailable',
      rich_analysis: 'unavailable',
    },
    conclusion,
    evidence,
  }
}

export async function getRunById(runId: string, perspective: Perspective = 'general'): Promise<TraceroRun> {
  if (USE_MOCK) {
    return {
      ...mockCurrentRun,
      run_id: runId,
      data_source: 'demo',
      data_provenance: {
        event: 'demo',
        conclusion: 'demo',
        evidence: 'demo',
        rich_analysis: 'demo',
      },
    }
  }

  const run = await requestJson<RunApiResponse>(
    `${endpoints.runs}/${encodeURIComponent(runId)}?perspective=${encodeURIComponent(perspective)}`
  )
  return mapRunDetailSnapshot(run)
}

export async function getCurrentRun(perspective: Perspective = 'general'): Promise<TraceroRun> {
  if (USE_MOCK) {
    return {
      ...mockCurrentRun,
      data_source: 'demo',
      data_provenance: {
        event: 'demo',
        conclusion: 'demo',
        evidence: 'demo',
        rich_analysis: 'demo',
      },
    }
  }

  const { runs } = await requestJson<RunsApiResponse>(endpoints.runs)
  const latestAgentRun = runs.find(isAgentRun)
  if (!latestAgentRun) {
    throw new Error('后端暂无 Agent 推理记录')
  }
  return getRunById(latestAgentRun.run_id, perspective)
}





