import type { TraceroEvidence, TraceroRun } from './types'

export type EvidenceKind =
  | 'runtime'
  | 'log'
  | 'parameter'
  | 'message'
  | 'code'
  | 'unknown'

export type NormalizedEvidence = {
  id: string
  kind: EvidenceKind
  rawType: string
  source: string
  entity: string
  field: string
  window: string
  timestamp?: number
  value?: unknown
  numericValue?: number
  content: string
  impact: string
  title: string
  fingerprint: string
  original: TraceroEvidence
}

export type EvidenceGroup = {
  key: string
  label: string
  kind: EvidenceKind
  source: string
  entity: string
  field: string
  window: string
  total: number
  items: NormalizedEvidence[]
  representativeIds: string[]
  allEvidenceIds: string[]
  summary: string
  statistics?: {
    min?: number
    max?: number
    first?: number
    last?: number
  }
}

export type EvidenceDigest = {
  keyEvidence: NormalizedEvidence[]
  keyReasons: Record<string, string[]>
  groups: EvidenceGroup[]
  rawEvidence: NormalizedEvidence[]
  citedEvidenceIds: Set<string>
}

const typeAliases: Record<EvidenceKind, string[]> = {
  runtime: ['runtime', 'metric', 'metrics', 'telemetry'],
  log: ['log', 'logs'],
  parameter: ['parameter', 'config', 'configuration'],
  message: ['message_mapping', 'message', 'topic_mapping'],
  code: ['source_code', 'code'],
  unknown: [],
}

function text(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const candidate = text(value).trim()
    if (candidate) return candidate
  }
  return ''
}

function kindFor(rawType: string): EvidenceKind {
  const normalized = rawType.toLowerCase()
  return (
    (Object.entries(typeAliases).find(([, aliases]) =>
      aliases.includes(normalized)
    )?.[0] as EvidenceKind | undefined) ?? 'unknown'
  )
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  if (value && typeof value === 'object') {
    const values = Object.values(value).filter(
      (item): item is number =>
        typeof item === 'number' && Number.isFinite(item)
    )
    if (values.length === 1) return values[0]
  }
  return undefined
}

function fingerprint(content: string) {
  return content
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
    .replace(
      /\b\d{1,4}[-/:]\d{1,2}[-/:]\d{1,4}(?:[t\s]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?\b/gi,
      '<time>'
    )
    .replace(/-?\d+(?:\.\d+)?/g, '<number>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeEvidence(
  item: TraceroEvidence,
  index: number,
  groupType?: string
): NormalizedEvidence {
  const raw = item as Record<string, unknown>
  const rawType = (groupType || text(raw.type) || 'unknown').toLowerCase()
  const kind = kindFor(rawType)
  const id =
    text(raw.evidence_id ?? raw.id) || `E-${String(index + 1).padStart(2, '0')}`
  const source = firstText(
    raw.source,
    raw.topic,
    raw.path,
    raw.file_path,
    raw.file
  )
  const entity = firstText(
    raw.entity,
    raw.module,
    raw.node,
    raw.component,
    raw.repository
  )
  const field = firstText(
    raw.field,
    raw.name,
    raw.parameter,
    raw.key,
    raw.function_name
  )
  const window = firstText(raw.window, raw.time_window)
  const value = raw.value ?? raw.data ?? raw.payload
  const content = firstText(
    raw.excerpt,
    raw.content,
    raw.code,
    raw.value,
    raw.data,
    raw.payload
  )
  const timestampValue = raw.timestamp ?? raw.time
  const timestamp =
    typeof timestampValue === 'number'
      ? timestampValue
      : typeof timestampValue === 'string' && timestampValue.trim()
        ? Date.parse(timestampValue)
        : undefined

  return {
    id,
    kind,
    rawType,
    source: source || '后端证据',
    entity,
    field,
    window,
    timestamp:
      timestamp !== undefined && Number.isFinite(timestamp)
        ? timestamp
        : undefined,
    value,
    numericValue: numericValue(value),
    content,
    impact:
      firstText(raw.impact, raw.description, raw.summary) ||
      '后端未提供该证据的影响说明。',
    title: firstText(raw.title, raw.name) || `${rawType} 证据`,
    fingerprint: fingerprint(content || `${source}:${field}:${id}`),
    original: item,
  }
}

function collectEvidence(run: TraceroRun) {
  const view = run.perspective_view
  const grouped = view?.evidence_by_type ?? {}
  const groupedItems = Object.entries(grouped).flatMap(([groupType, items]) =>
    (items ?? []).map((item, index) =>
      normalizeEvidence(item, index, groupType)
    )
  )
  const fallbackItems = (view?.evidence ?? run.evidence ?? []).map(
    (item, index) => normalizeEvidence(item, index)
  )
  const candidates = groupedItems.length ? groupedItems : fallbackItems
  const seen = new Set<string>()

  return candidates.filter((item) => {
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function groupKey(item: NormalizedEvidence) {
  if (item.kind === 'log') {
    return [item.kind, item.source, item.entity, item.fingerprint].join('|')
  }
  return [item.kind, item.source, item.entity, item.field, item.window].join(
    '|'
  )
}

function groupLabel(item: NormalizedEvidence) {
  return (
    [item.source, item.entity, item.field, item.window]
      .filter(Boolean)
      .join(' · ') || item.title
  )
}

function buildGroup(items: NormalizedEvidence[]): EvidenceGroup {
  const first = items[0]
  const numericItems = items.filter(
    (item): item is NormalizedEvidence & { numericValue: number } =>
      item.numericValue !== undefined
  )
  const sortedNumeric = [...numericItems].sort(
    (left, right) => left.numericValue - right.numericValue
  )
  const chronological = [...items].sort(
    (left, right) =>
      (left.timestamp ?? Number.POSITIVE_INFINITY) -
      (right.timestamp ?? Number.POSITIVE_INFINITY)
  )
  const representative = [
    chronological[0],
    chronological[chronological.length - 1],
    sortedNumeric[0],
    sortedNumeric[sortedNumeric.length - 1],
  ].filter((item): item is NormalizedEvidence => Boolean(item))
  const representativeIds = [
    ...new Set(representative.map((item) => item.id)),
  ].slice(0, 4)
  const statistics = numericItems.length
    ? {
        min: sortedNumeric[0]?.numericValue,
        max: sortedNumeric[sortedNumeric.length - 1]?.numericValue,
        first: chronological.find((item) => item.numericValue !== undefined)
          ?.numericValue,
        last: [...chronological]
          .reverse()
          .find((item) => item.numericValue !== undefined)?.numericValue,
      }
    : undefined

  return {
    key: groupKey(first),
    label: groupLabel(first),
    kind: first.kind,
    source: first.source,
    entity: first.entity,
    field: first.field,
    window: first.window,
    total: items.length,
    items: chronological,
    representativeIds,
    allEvidenceIds: items.map((item) => item.id),
    summary:
      items.length === 1
        ? first.impact
        : `${items.length} 条同类证据，保留首尾、极值和结论引用作为代表。`,
    statistics,
  }
}

function extractEvidenceIds(value: string) {
  return value.match(/\bE-[A-Za-z0-9_-]+\b/g) ?? []
}

function cleanSummaryText(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\bE-[A-Za-z0-9_-]+\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。；：、])/g, '$1')
    .trim()
}

export function countSupportingEvidence(run: TraceroRun) {
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const citedEvidenceIds = new Set(
    extractEvidenceIds(
      [conclusion.fact, conclusion.reasoning, conclusion.suggestion].join(' ')
    )
  )
  if (citedEvidenceIds.size) return citedEvidenceIds.size

  const rounds =
    run.perspective_view?.reasoning_rounds ?? run.reasoning_rounds ?? []
  const roundEvidenceIds = new Set(
    rounds.flatMap((round) => round.evidence_ids ?? [])
  )
  if (roundEvidenceIds.size) return roundEvidenceIds.size

  return run.perspective_view?.evidence?.length ?? run.evidence?.length ?? 0
}

export function buildLaymanSummary(run: TraceroRun) {
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const text = [conclusion.fact, conclusion.reasoning, conclusion.suggestion]
    .filter(Boolean)
    .join(' ')

  const patterns: Array<{ test: RegExp; summary: string }> = [
    {
      test: /(非故障|正常触发|安全.*?触发|按.*?规则.*?(减速|避障|停车))/,
      summary: '这不是系统坏了，而是系统按安全规则主动减速或避障。',
    },
    {
      test: /(障碍物|减速|避障|刹停|急停)/,
      summary: '前方出现风险后，系统先降速或停车，避免继续往前冲。',
    },
    {
      test: /(过期|旧地图|stale|延迟|超时)/,
      summary: '系统拿到的是过期信息，所以反应比现场变化慢了一拍。',
    },
    {
      test: /(阈值|update_frequency|参数|配置)/,
      summary: '问题更像是参数偏保守，系统先按安全侧规则处理了。',
    },
  ]

  for (const pattern of patterns) {
    if (pattern.test.test(text)) return pattern.summary
  }

  const compact = cleanSummaryText(text)
  if (compact) {
    const sentence = compact.split(/[。！？]/)[0]?.trim()
    if (sentence) return sentence.endsWith('。') ? sentence : `${sentence}。`
  }

  return '系统已经识别到异常，并按当前规则给出了处理结果。'
}

function scoreEvidence(
  item: NormalizedEvidence,
  citedIds: Set<string>,
  roundIds: Set<string>,
  representativeIds: Set<string>,
  fingerprintCount: Map<string, number>
) {
  let score = 0
  if (citedIds.has(item.id)) score += 100
  if (roundIds.has(item.id)) score += 60
  if (representativeIds.has(item.id)) score += 30
  if (item.kind === 'parameter' || item.kind === 'code') score += 25
  if (/\b(error|fatal|critical|exception|failed)\b/i.test(item.content)) {
    score += 25
  }
  if ((fingerprintCount.get(item.fingerprint) ?? 0) === 1) score += 15
  else score -= 10
  return score
}

export function buildEvidenceDigest(
  run: TraceroRun,
  options: { keyLimit?: number; perGroupLimit?: number } = {}
): EvidenceDigest {
  const rawEvidence = collectEvidence(run)
  const groupMap = new Map<string, NormalizedEvidence[]>()
  for (const item of rawEvidence) {
    const key = groupKey(item)
    groupMap.set(key, [...(groupMap.get(key) ?? []), item])
  }
  const groups = [...groupMap.values()]
    .map(buildGroup)
    .sort((left, right) => right.total - left.total)
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const citedEvidenceIds = new Set(
    extractEvidenceIds(
      [conclusion.fact, conclusion.reasoning, conclusion.suggestion].join(' ')
    )
  )
  const rounds =
    run.perspective_view?.reasoning_rounds ?? run.reasoning_rounds ?? []
  const roundIds = new Set(rounds.flatMap((round) => round.evidence_ids))
  const representativeIds = new Set(
    groups.flatMap((group) => group.representativeIds)
  )
  const fingerprintCount = new Map<string, number>()
  rawEvidence.forEach((item) =>
    fingerprintCount.set(
      item.fingerprint,
      (fingerprintCount.get(item.fingerprint) ?? 0) + 1
    )
  )
  const perGroupLimit = options.perGroupLimit ?? 3
  const keyLimit = options.keyLimit ?? 20
  const selectedPerGroup = new Map<string, number>()
  const keyEvidence = [...rawEvidence]
    .sort(
      (left, right) =>
        scoreEvidence(
          right,
          citedEvidenceIds,
          roundIds,
          representativeIds,
          fingerprintCount
        ) -
        scoreEvidence(
          left,
          citedEvidenceIds,
          roundIds,
          representativeIds,
          fingerprintCount
        )
    )
    .filter((item) => {
      const key = groupKey(item)
      const selected = selectedPerGroup.get(key) ?? 0
      const groupLimit = citedEvidenceIds.has(item.id)
        ? Math.max(perGroupLimit, 5)
        : perGroupLimit
      if (selected >= groupLimit) {
        return false
      }
      selectedPerGroup.set(key, selected + 1)
      return true
    })
    .slice(0, keyLimit)
  const keyReasons: Record<string, string[]> = {}
  keyEvidence.forEach((item) => {
    const reasons: string[] = []
    if (citedEvidenceIds.has(item.id)) reasons.push('结论直接引用')
    if (roundIds.has(item.id)) reasons.push('本轮引用')
    if (item.kind === 'parameter') reasons.push('参数证据')
    if (item.kind === 'code') reasons.push('代码证据')
    if (/\b(error|fatal|critical|exception|failed)\b/i.test(item.content)) {
      reasons.push('异常信号')
    }
    const group = groups.find((candidate) =>
      candidate.allEvidenceIds.includes(item.id)
    )
    if (group?.representativeIds.includes(item.id)) {
      if (group.statistics?.first === item.numericValue)
        reasons.push('时间窗口首值')
      if (group.statistics?.last === item.numericValue)
        reasons.push('时间窗口末值')
      if (group.statistics?.min === item.numericValue)
        reasons.push('数值最小值')
      if (group.statistics?.max === item.numericValue)
        reasons.push('数值最大值')
      if (group.total > 1 && reasons.length === 0)
        reasons.push(`同类 ${group.total} 条的代表`)
    }
    keyReasons[item.id] = reasons.length ? [...new Set(reasons)] : ['规则筛选']
  })

  return { keyEvidence, keyReasons, groups, rawEvidence, citedEvidenceIds }
}
