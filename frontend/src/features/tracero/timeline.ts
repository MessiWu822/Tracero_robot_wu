import type { TimelineLevel } from './mock-data'
import type { TraceroRun } from './types'

type TimelineItem = NonNullable<TraceroRun['timeline']>[number]

type TimelineRunResponse = {
  created_at: string
  trigger_time: number | null
  progress: string | null
  status?:
    | 'pending'
    | 'received'
    | 'processing'
    | 'reasoning'
    | 'completed'
    | 'done'
    | 'verification_failed'
    | 'failed'
  raw_event?: {
    window?: Record<string, Array<Record<string, unknown>>>
  }
  evidence?: Array<Record<string, unknown>>
  timeline?: Array<Record<string, unknown>>
}

export type TimelineSource = 'backend' | 'derived'

export type RunTimeline = {
  items: TimelineItem[]
  source: TimelineSource
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value === undefined || value === null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(record[key])
    if (value) return value
  }
  return ''
}

function timestampMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value
  }
  if (typeof value !== 'string' || !value.trim()) return undefined
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function formatTime(value: unknown, fallback: unknown): string {
  const time = timestampMs(value) ?? timestampMs(fallback)
  if (time === undefined) return '--:--:--'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(time))
}

function timelineLevel(value: unknown): TimelineLevel {
  const level = text(value).toLowerCase()
  if (level === 'success' || level === 'done' || level === 'completed') {
    return 'success'
  }
  if (level === 'critical' || level === 'error' || level === 'failed') {
    return 'critical'
  }
  if (level === 'warning' || level === 'warn') return 'warning'
  return 'info'
}

function formatData(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return text(value)
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      const itemText = text(item)
      return itemText ? `${key}=${itemText}` : ''
    })
    .filter(Boolean)
    .join('，')
}

function explicitTimeline(
  response: TimelineRunResponse
): TimelineItem[] | undefined {
  if (!response.timeline?.length) return undefined

  const items = response.timeline.flatMap((item) => {
    const title = firstText(item, ['title', 'name', 'event'])
    const description = firstText(item, [
      'description',
      'detail',
      'message',
      'summary',
    ])
    if (!title || !description) return []

    const rawTime = item.time ?? item.timestamp ?? item.created_at
    return [
      {
        time:
          typeof rawTime === 'string' && timestampMs(rawTime) === undefined
            ? rawTime
            : formatTime(rawTime, response.created_at),
        title,
        description,
        level: timelineLevel(item.level ?? item.severity ?? item.status),
      },
    ]
  })

  return items.length ? items : undefined
}

function eventDescription(item: Record<string, unknown>): string {
  return (
    firstText(item, ['description', 'detail', 'message', 'summary']) ||
    formatData(item.data) ||
    '后端记录了该事件节点。'
  )
}

function eventTitle(item: Record<string, unknown>): string {
  const topic = firstText(item, ['topic', 'source', 'type'])
  if (topic === 'user_question') return '用户提出问题'
  if (topic === 'follow_up_question') return '用户继续追问'
  return (
    firstText(item, ['title', 'name']) ||
    (topic ? `采集 ${topic}` : '采集事件数据')
  )
}

function derivedTimeline(response: TimelineRunResponse): TimelineItem[] {
  const sortable: Array<{ order: number; item: TimelineItem }> = []
  let sequence = 0
  const fallbackTrigger = response.trigger_time ?? response.created_at

  for (const entries of Object.values(response.raw_event?.window ?? {})) {
    for (const event of entries) {
      const rawTime = event.timestamp ?? event.time ?? event.created_at
      sortable.push({
        order:
          timestampMs(rawTime) ?? timestampMs(fallbackTrigger) ?? sequence++,
        item: {
          time: formatTime(rawTime, fallbackTrigger),
          title: eventTitle(event),
          description: eventDescription(event),
          level: timelineLevel(event.level ?? event.severity ?? event.status),
        },
      })
    }
  }

  for (const [index, evidence] of (response.evidence ?? []).entries()) {
    const evidenceId =
      firstText(evidence, ['evidence_id', 'id']) || `E-${index + 1}`
    const title = firstText(evidence, ['title', 'name'])
    const description =
      firstText(evidence, [
        'impact',
        'description',
        'summary',
        'excerpt',
        'content',
        'value',
      ]) || '后端已将该证据纳入本次推理。'
    const rawTime = evidence.timestamp ?? evidence.time ?? evidence.created_at
    sortable.push({
      order:
        timestampMs(rawTime) ?? timestampMs(response.created_at) ?? sequence++,
      item: {
        time: formatTime(rawTime, response.created_at),
        title: `纳入证据 ${evidenceId}${title ? `：${title}` : ''}`,
        description,
        level: timelineLevel(
          evidence.level ?? evidence.severity ?? evidence.status
        ),
      },
    })
  }

  const isComplete =
    response.status === 'done' || response.status === 'completed'
  const isFailed =
    response.status === 'failed' || response.status === 'verification_failed'
  sortable.push({
    order: timestampMs(response.created_at) ?? Number.MAX_SAFE_INTEGER,
    item: {
      time: formatTime(response.created_at, fallbackTrigger),
      title: isComplete
        ? '推理结果生成'
        : isFailed
          ? '推理失败'
          : '推理处理中',
      description:
        response.progress ||
        (isComplete
          ? '后端已完成证据校验并生成结论。'
          : isFailed
            ? '后端未能生成通过证据校验的结论。'
            : '后端正在处理 Agent 事件证据。'),
      level: isComplete ? 'success' : isFailed ? 'critical' : 'info',
    },
  })

  return sortable
    .sort((left, right) => left.order - right.order)
    .map(({ item }) => item)
}

export function buildRunTimeline(response: TimelineRunResponse): RunTimeline {
  const backendItems = explicitTimeline(response)
  if (backendItems) return { items: backendItems, source: 'backend' }
  return { items: derivedTimeline(response), source: 'derived' }
}
