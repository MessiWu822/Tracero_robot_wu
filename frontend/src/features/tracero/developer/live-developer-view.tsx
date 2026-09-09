import { useMemo, useState } from 'react'
import {
  Activity,
  Braces,
  Code2,
  FileText,
  GitBranch,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildEvidenceDigest,
  type EvidenceGroup,
  type EvidenceKind,
  type NormalizedEvidence,
} from '../evidence-intelligence'
import type { TraceroEvidence, TraceroRun } from '../types'

type DeveloperTab = 'code' | 'config' | 'logs' | 'runtime'

type DeveloperEvidence = TraceroEvidence & {
  bucket: DeveloperTab
  rawType: string
  displayKey: string
}

const tabMeta: Array<{
  value: DeveloperTab
  label: string
  icon: typeof Code2
}> = [
  { value: 'code', label: '代码', icon: Code2 },
  { value: 'config', label: '参数与映射', icon: Settings2 },
  { value: 'logs', label: '日志', icon: FileText },
  { value: 'runtime', label: '运行数据', icon: Activity },
]

function bucketForKind(kind: EvidenceKind): DeveloperTab {
  if (kind === 'code') return 'code'
  if (kind === 'parameter' || kind === 'message') return 'config'
  if (kind === 'runtime') return 'runtime'
  return 'logs'
}

function toDeveloperEvidence(item: NormalizedEvidence): DeveloperEvidence {
  const bucket = bucketForKind(item.kind)
  return {
    ...item.original,
    evidence_id: item.id,
    type:
      bucket === 'code'
        ? 'code'
        : bucket === 'config'
          ? 'config'
          : bucket === 'runtime'
            ? 'metric'
            : 'log',
    title: item.title,
    source: item.source,
    excerpt: item.content,
    impact: item.impact,
    bucket,
    rawType: item.rawType,
    displayKey: `${item.id}-${item.rawType}`,
  }
}

export function LiveDeveloperView({ run }: { run: TraceroRun }) {
  const digest = useMemo(() => buildEvidenceDigest(run), [run])
  const evidence = useMemo(
    () => digest.rawEvidence.map(toDeveloperEvidence),
    [digest]
  )
  const keyEvidence = useMemo(
    () => digest.keyEvidence.map(toDeveloperEvidence),
    [digest]
  )
  const rounds =
    run.perspective_view?.reasoning_rounds ?? run.reasoning_rounds ?? []
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const focus =
    run.perspective_view?.focus || '围绕代码、配置、日志和运行数据定位异常'
  const [activeTab, setActiveTab] = useState<DeveloperTab>(() =>
    evidence.some((item) => item.bucket === 'code') ? 'code' : 'logs'
  )
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>()
  const counts = Object.fromEntries(
    tabMeta.map(({ value }) => [
      value,
      evidence.filter((item) => item.bucket === value).length,
    ])
  ) as Record<DeveloperTab, number>
  const citedIds = digest.citedEvidenceIds

  function selectEvidence(evidenceId: string) {
    const item = evidence.find(
      (candidate) => candidate.evidence_id === evidenceId
    )
    if (!item) return
    setActiveTab(item.bucket)
    setSelectedEvidenceId(item.evidence_id)
  }

  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.10),transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))] dark:bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.22),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.98))]'>
      <div className='shrink-0 border-b border-indigo-200/70 bg-background/75 p-3 backdrop-blur dark:border-indigo-950/70 dark:bg-background/55'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm'>
              <GitBranch className='size-4' />
            </div>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='text-sm font-semibold'>开发定位工作台</h2>
                <Badge variant='outline' className='font-mono text-[10px]'>
                  {run.run_id}
                </Badge>
              </div>
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>
                {focus}
              </p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge className='bg-indigo-600 text-white hover:bg-indigo-600'>
              {evidence.length} 条开发证据
            </Badge>
            <Badge variant='secondary'>{rounds.length} 轮推理</Badge>
          </div>
        </div>

        <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground'>
          <span className='font-medium text-emerald-700 dark:text-emerald-300'>
            {run.status === 'done' ? '分析完成' : '分析进行中'}
          </span>
          <span>{evidence.length} 条分析证据</span>
          <span>
            运行 {Number(counts.runtime)} · 参数 {Number(counts.config)} · 日志{' '}
            {Number(counts.logs)} · 代码 {Number(counts.code)}
          </span>
          <span>{rounds.length} 轮推理</span>
          <span>
            数据窗口：
            {String(
              evidence.find((item) => item.window)?.window || '后端未提供'
            )}
          </span>
          <span>
            来源：
            {run.data_source === 'robot'
              ? '真实数据'
              : run.data_source || '后端返回'}
          </span>
        </div>
        <div className='mt-2 grid gap-2 lg:grid-cols-3'>
          <ConclusionCard
            label='事实'
            content={conclusion.fact}
            tone='sky'
            citedIds={citedIds}
            onSelect={selectEvidence}
          />
          <ConclusionCard
            label='开发判断'
            content={conclusion.reasoning}
            tone='violet'
            citedIds={citedIds}
            onSelect={selectEvidence}
          />
          <ConclusionCard
            label='处理建议'
            content={conclusion.suggestion}
            tone='emerald'
            citedIds={citedIds}
            onSelect={selectEvidence}
          />
        </div>
      </div>

      <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]'>
        <aside className='min-h-0 overflow-hidden border-b bg-background/65 lg:border-r lg:border-b-0'>
          <div className='border-b px-3 py-2'>
            <p className='flex items-center gap-2 text-xs font-semibold'>
              <Braces className='size-3.5 text-indigo-600' />
              推理与证据调用链
            </p>
          </div>
          <ScrollArea className='h-[calc(100%-37px)]'>
            <div className='space-y-2 p-3'>
              {rounds.length ? (
                rounds.map((round) => {
                  const roundIdSet = new Set(round.evidence_ids)
                  const roundItems = evidence.filter((item) =>
                    roundIdSet.has(item.evidence_id)
                  )
                  const keyIds = roundItems.slice(0, 8)

                  return (
                    <article
                      key={round.round}
                      className='rounded-md border bg-card/90 p-3 shadow-sm'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <strong className='text-xs'>
                          第 {round.round} 轮 · {round.title || '推理分析'}
                        </strong>
                        <Badge variant='outline' className='text-[10px]'>
                          {keyIds.length}/{round.evidence_ids.length} 条可解析
                        </Badge>
                      </div>
                      {round.tool_calls.length ? (
                        <p className='mt-2 truncate font-mono text-[10px] text-indigo-700 dark:text-indigo-300'>
                          调用：{round.tool_calls.join('、')}
                        </p>
                      ) : null}
                      <p className='mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground'>
                        {round.reasoning ||
                          (roundItems.length
                            ? `本轮获取 ${roundItems.length} 条证据并继续验证。`
                            : '本轮未返回推理摘要。')}
                      </p>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {keyIds.map((item) => (
                          <button
                            key={item.evidence_id}
                            type='button'
                            className='rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-indigo-400 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none'
                            onClick={() => selectEvidence(item.evidence_id)}
                          >
                            {item.evidence_id}
                          </button>
                        ))}
                      </div>
                      {round.evidence_ids.length > keyIds.length ? (
                        <p className='mt-2 text-[10px] text-muted-foreground'>
                          其余证据已自动归组，可在右侧“分组”或“全部”中查看。
                        </p>
                      ) : null}
                    </article>
                  )
                })
              ) : (
                <EmptyState message='后端尚未返回开发视角的推理轮次。' />
              )}
            </div>
          </ScrollArea>
        </aside>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DeveloperTab)}
          className='min-h-0 gap-0 overflow-hidden'
        >
          <div className='shrink-0 border-b bg-background/65 p-2'>
            <TabsList className='grid w-full grid-cols-4'>
              {tabMeta.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon />
                  <span className='hidden sm:inline'>{label}</span>
                  <Badge variant='secondary' className='px-1 text-[9px]'>
                    {counts[value]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabMeta.map(({ value, label }) => (
            <TabsContent
              key={value}
              value={value}
              className='min-h-0 overflow-hidden'
            >
              <EvidenceWorkspace
                label={label}
                items={evidence.filter((item) => item.bucket === value)}
                keyItems={keyEvidence.filter((item) => item.bucket === value)}
                keyReasons={digest.keyReasons}
                groups={digest.groups.filter(
                  (group) => bucketForKind(group.kind) === value
                )}
                selectedEvidenceId={selectedEvidenceId}
                onSelect={setSelectedEvidenceId}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

function ConclusionCard({
  label,
  content,
  tone,
  citedIds,
  onSelect,
}: {
  label: string
  content: string
  tone: 'sky' | 'violet' | 'emerald'
  citedIds: Set<string>
  onSelect: (evidenceId: string) => void
}) {
  const styles = {
    sky: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/20',
    violet:
      'border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/20',
    emerald:
      'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20',
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          className={cn(
            'group flex h-[104px] min-w-0 flex-col rounded-md border p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
            styles[tone]
          )}
          aria-label={`查看完整${label}`}
        >
          <span className='text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'>
            {label}
          </span>
          <span className='mt-1 [display:-webkit-box] h-10 min-h-10 overflow-hidden text-xs leading-5 break-words [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
            {content || '后端暂未提供。'}
          </span>
          <span className='mt-1 flex h-4 min-h-4 items-center gap-1 overflow-hidden text-[10px] whitespace-nowrap text-muted-foreground'>
            依据：
            {[...citedIds].slice(0, 3).map((id) => (
              <button
                key={id}
                type='button'
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(id)
                }}
                className='font-mono text-indigo-600 hover:underline dark:text-indigo-300'
              >
                {id}
              </button>
            ))}
            {citedIds.size > 3
              ? ` +${citedIds.size - 3}`
              : citedIds.size === 0
                ? '后端未返回可解析引用'
                : ''}
          </span>
          <span className='h-4 min-h-4 pt-0.5 text-[10px] font-medium text-indigo-600 opacity-75 transition-opacity group-hover:opacity-100 dark:text-indigo-300'>
            查看完整内容
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className='max-h-[82svh] overflow-hidden sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>开发视角 · {label}</DialogTitle>
          <DialogDescription>
            完整展示当前 Run 在开发视角下的{label}内容。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[60svh] rounded-md border bg-muted/20'>
          <p className='p-4 text-sm leading-7 break-words whitespace-pre-wrap'>
            {content || '后端暂未提供。'}
          </p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function EvidenceWorkspace({
  label,
  items,
  keyItems,
  keyReasons,
  groups,
  selectedEvidenceId,
  onSelect,
}: {
  label: string
  items: DeveloperEvidence[]
  keyItems: DeveloperEvidence[]
  keyReasons: Record<string, string[]>
  groups: EvidenceGroup[]
  selectedEvidenceId?: string
  onSelect: (evidenceId: string) => void
}) {
  const [mode, setMode] = useState<'key' | 'groups' | 'all'>('key')
  const [visibleCount, setVisibleCount] = useState(50)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const matchesQuery = (item: DeveloperEvidence) =>
    !normalizedQuery ||
    [item.evidence_id, item.title, item.source, item.excerpt, item.impact]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  const filteredItems = items.filter(matchesQuery)
  const filteredKeyItems = keyItems.filter(matchesQuery)
  const filteredGroups = groups.filter(
    (group) =>
      !normalizedQuery ||
      [
        group.label,
        group.source,
        group.entity,
        group.field,
        group.window,
        ...group.allEvidenceIds,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
  )
  const displayItems =
    mode === 'key' ? filteredKeyItems : filteredItems.slice(0, visibleCount)
  const selected =
    filteredItems.find((item) => item.evidence_id === selectedEvidenceId) ??
    displayItems[0] ??
    filteredItems[0]

  if (!items.length) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <EmptyState
          message={
            label === '代码'
              ? '本次后端结果未返回代码证据。当前数据中未包含文件路径、函数名、行号、仓库或 Commit 信息；代码证据为 0 不代表代码不存在问题。'
              : `该开发视角暂无${label}证据。`
          }
        />
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden'>
      <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background/70 px-3 py-2'>
        <p className='text-xs text-muted-foreground'>
          {label}：默认展示关键证据，原始数据始终保留
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='搜索 ID、来源或内容'
            className='h-7 w-48 text-xs'
          />
          <div className='inline-flex rounded-md border bg-muted/40 p-0.5'>
            {[
              { value: 'key' as const, label: `关键 ${keyItems.length}` },
              { value: 'groups' as const, label: `分组 ${groups.length}` },
              { value: 'all' as const, label: `全部 ${items.length}` },
            ].map((option) => (
              <button
                key={option.value}
                type='button'
                className={cn(
                  'rounded px-2.5 py-1 text-[11px] transition-colors',
                  mode === option.value
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'groups' ? (
        <GroupWorkspace
          groups={filteredGroups}
          selectedGroupKey={selectedGroupKey}
          onSelectGroup={setSelectedGroupKey}
          onOpenEvidence={(evidenceId) => {
            onSelect(evidenceId)
            setMode('all')
          }}
        />
      ) : (
        <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]'>
          <ScrollArea className='min-h-32 border-b xl:border-r xl:border-b-0'>
            <div className='space-y-2 p-3'>
              {displayItems.length ? (
                displayItems.map((item) => (
                  <button
                    key={item.displayKey}
                    type='button'
                    className={cn(
                      'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none dark:hover:bg-indigo-950/20',
                      selected?.evidence_id === item.evidence_id &&
                        'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30'
                    )}
                    onClick={() => onSelect(item.evidence_id)}
                  >
                    <span className='flex items-center justify-between gap-2'>
                      <strong className='truncate text-xs'>{item.title}</strong>
                      <Badge
                        variant='outline'
                        className='shrink-0 font-mono text-[9px]'
                      >
                        {item.evidence_id}
                      </Badge>
                    </span>
                    <span className='mt-1 block truncate font-mono text-[10px] text-muted-foreground'>
                      {item.source}
                    </span>
                    <span className='mt-1 flex flex-wrap gap-1'>
                      {(keyReasons[item.evidence_id] ?? [])
                        .slice(0, 2)
                        .map((reason) => (
                          <Badge
                            key={reason}
                            variant='secondary'
                            className='px-1 text-[9px]'
                          >
                            {reason}
                          </Badge>
                        ))}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState message={`该分类暂无关键${label}证据。`} />
              )}
              {mode === 'all' && visibleCount < filteredItems.length ? (
                <button
                  type='button'
                  className='w-full rounded-md border border-dashed px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/20'
                  onClick={() => setVisibleCount((count) => count + 50)}
                >
                  再显示 50 条（剩余 {filteredItems.length - visibleCount} 条）
                </button>
              ) : null}
            </div>
          </ScrollArea>

          {selected ? (
            <EvidenceDetail item={selected} />
          ) : (
            <div className='flex min-h-0 items-center justify-center p-6'>
              <EmptyState message='没有匹配当前搜索条件的证据。' />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GroupWorkspace({
  groups,
  selectedGroupKey,
  onSelectGroup,
  onOpenEvidence,
}: {
  groups: EvidenceGroup[]
  selectedGroupKey?: string
  onSelectGroup: (key: string) => void
  onOpenEvidence: (evidenceId: string) => void
}) {
  const selected =
    groups.find((group) => group.key === selectedGroupKey) ?? groups[0]

  if (!selected) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center p-6'>
        <EmptyState message='该分类暂无可聚合的证据。' />
      </div>
    )
  }

  return (
    <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)]'>
      <ScrollArea className='min-h-32 border-b xl:border-r xl:border-b-0'>
        <div className='space-y-2 p-3'>
          {groups.map((group) => (
            <button
              key={group.key}
              type='button'
              className={cn(
                'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
                selected.key === group.key &&
                  'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30'
              )}
              onClick={() => onSelectGroup(group.key)}
            >
              <span className='flex items-start justify-between gap-2'>
                <strong className='line-clamp-2 text-xs'>{group.label}</strong>
                <Badge variant='secondary' className='shrink-0 text-[9px]'>
                  {group.total} 条
                </Badge>
              </span>
              <span className='mt-1 block text-[10px] text-muted-foreground'>
                {group.kind}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>

      <ScrollArea className='min-h-0'>
        <article className='p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-sm font-semibold'>{selected.label}</h3>
              <p className='mt-1 text-xs text-muted-foreground'>
                {selected.summary}
              </p>
            </div>
            <Badge variant='outline'>{selected.total} 条原始证据</Badge>
          </div>

          {selected.statistics ? (
            <div className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4'>
              {[
                ['首值', selected.statistics.first],
                ['末值', selected.statistics.last],
                ['最小值', selected.statistics.min],
                ['最大值', selected.statistics.max],
              ].map(([label, value]) => (
                <div key={label} className='rounded-md border bg-muted/20 p-2'>
                  <p className='text-[10px] text-muted-foreground'>{label}</p>
                  <p className='mt-1 truncate font-mono text-xs font-semibold'>
                    {value ?? '-'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className='mt-4'>
            <p className='text-xs font-semibold'>代表证据</p>
            <div className='mt-2 flex flex-wrap gap-2'>
              {selected.representativeIds.map((evidenceId) => (
                <button
                  key={evidenceId}
                  type='button'
                  className='rounded-md border bg-background px-2 py-1 font-mono text-xs hover:border-indigo-400 hover:text-indigo-700'
                  onClick={() => onOpenEvidence(evidenceId)}
                >
                  {evidenceId}
                </button>
              ))}
            </div>
          </div>
        </article>
      </ScrollArea>
    </div>
  )
}

function EvidenceDetail({ item }: { item: DeveloperEvidence }) {
  return (
    <ScrollArea className='min-h-0'>
      <article className='p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='text-sm font-semibold'>{item.title}</h3>
              <Badge variant='secondary'>{item.rawType}</Badge>
            </div>
            <p className='mt-1 font-mono text-[11px] break-all text-muted-foreground'>
              {item.source}
            </p>
          </div>
          <Badge variant='outline' className='font-mono'>
            {item.evidence_id}
          </Badge>
        </div>

        <div className='mt-4'>
          <p className='mb-2 text-xs font-semibold text-muted-foreground'>
            证据内容
          </p>
          {item.excerpt ? (
            <pre className='max-h-72 overflow-auto rounded-md border bg-slate-950 p-4 font-mono text-xs leading-6 whitespace-pre-wrap text-slate-100'>
              {item.excerpt}
            </pre>
          ) : (
            <EmptyState message='后端未提供该证据的具体内容。' />
          )}
        </div>

        <div className='mt-4 rounded-md border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/20'>
          <p className='text-xs font-semibold'>对本次异常的影响</p>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
            {item.impact}
          </p>
        </div>
      </article>
    </ScrollArea>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className='rounded-md border border-dashed bg-muted/20 p-5 text-center text-xs text-muted-foreground'>
      {message}
    </div>
  )
}
