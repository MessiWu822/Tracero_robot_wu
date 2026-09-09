import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  List,
  MessageSquareText,
  Send,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTracero } from '@/context/use-tracero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizablePanels } from '@/components/ui/resizable-panels'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { askRunQuestion } from './api'
import { downloadBugReport, hasDemoReportContent } from './bug-report'
import { LiveDeveloperView } from './developer/live-developer-view'
import {
  buildLaymanSummary,
  countSupportingEvidence,
} from './evidence-intelligence'
import { mockCurrentRun } from './mock-data'
import type { AgentPushStatus, TraceroRun, UserRole } from './types'

// Set this to false for an immediate, behavior-level rollback to the previous
// generic perspective panel. The API, polling, routing, and chat contract are
// intentionally outside this feature flag.
const ENABLE_LIVE_DEVELOPER_VIEW = true

type ReasoningRound = {
  id: string
  label: string
  title: string
  fact: string
  reasoning: string[]
  conclusion: string
  evidence: NonNullable<TraceroRun['evidence']>
}

function evidenceSequence(evidenceId: string) {
  const match = evidenceId.match(/(\d+)$/)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

function sortEvidence<T extends { evidence_id: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const sequenceDifference =
      evidenceSequence(left.evidence_id) - evidenceSequence(right.evidence_id)
    return (
      sequenceDifference || left.evidence_id.localeCompare(right.evidence_id)
    )
  })
}

function inferConfidence(run: TraceroRun) {
  const count =
    run.perspective_view?.evidence?.length ?? run.evidence?.length ?? 0
  if (run.status === 'done') return Math.min(96, 76 + count)
  if (run.status === 'reasoning') return Math.min(90, 64 + count)
  return Math.min(84, 58 + count)
}

function inferElapsed(run: TraceroRun) {
  const rounds =
    run.perspective_view?.reasoning_rounds ?? run.reasoning_rounds ?? []
  if (rounds.length) return `${Math.max(1, rounds.length * 3)} 秒`
  const count = run.perspective_view?.evidence?.length ?? run.evidence?.length ?? 0
  return `${Math.max(1, Math.round(count * 0.6))} 秒`
}

function inferObstacleDistance(run: TraceroRun) {
  const text = [
    run.conclusion.fact,
    run.conclusion.reasoning,
    run.conclusion.suggestion,
  ].join(' ')
  const match = text.match(/(\d+(?:\.\d+)?)\s*m/)
  return match ? Number(match[1]) : 1.1
}

function inferObstacleRadius(run: TraceroRun) {
  const count = run.perspective_view?.evidence?.length ?? run.evidence?.length ?? 0
  return Math.max(0.18, Math.min(0.5, 0.18 + count * 0.015))
}

function normalizeDisplayEvidence(
  item: NonNullable<TraceroRun['evidence']>[number]
) {
  const raw = item as Record<string, unknown>
  const rawType = raw.type
  const type =
    rawType === 'source_code'
      ? 'code'
      : rawType === 'parameter' || rawType === 'message_mapping'
        ? 'config'
        : rawType === 'runtime'
          ? 'log'
          : item.type

  return {
    ...item,
    type,
    source: item.source || String(raw.topic ?? raw.path ?? '后端证据'),
    title: item.title || `证据 ${item.evidence_id}`,
    excerpt:
      item.excerpt ||
      JSON.stringify(raw.content ?? raw.data ?? raw.payload ?? raw),
  }
}

function mergeEvidenceByQuality(
  items: NonNullable<TraceroRun['evidence']>
) {
  return items.map(normalizeDisplayEvidence).reduce<NonNullable<TraceroRun['evidence']>>(
    (merged, item) => {
      const index = merged.findIndex(
        (candidate) => candidate.evidence_id === item.evidence_id
      )
      if (index === -1) return [...merged, item]
      const quality = (evidence: typeof item) =>
        Number(Boolean(evidence.excerpt)) +
        Number(evidence.source !== '后端证据') +
        Number(evidence.impact !== '后端未提供证据说明。')
      if (quality(item) > quality(merged[index])) {
        const next = [...merged]
        next[index] = item
        return next
      }
      return merged
    },
    []
  )
}

function buildPreviewRounds(run: TraceroRun): ReasoningRound[] {
  const perspectiveView = run.perspective_view
  const timeline = run.timeline ?? []
  const evidence = [
    ...(perspectiveView?.evidence ?? []),
    ...Object.values(perspectiveView?.evidence_by_type ?? {}).flat(),
    ...(run.evidence ?? []),
  ]
  const mergedEvidence = mergeEvidenceByQuality(evidence)

  const reasoningRounds =
    perspectiveView?.reasoning_rounds ?? run.reasoning_rounds

  if (run.data_source === 'robot') {
    const evidenceById = new Map(
      mergedEvidence.map((item) => [item.evidence_id, item])
    )

    return (reasoningRounds ?? []).map((round, index, rounds) => {
      const linkedEvidence = (round.evidence_ids ?? [])
        .map((id) => evidenceById.get(id))
        .filter(
          (item): item is (typeof evidence)[number] => Boolean(item)
        )
      const roundEvidence = mergeEvidenceByQuality([
        ...(round.evidence ?? []),
        ...linkedEvidence,
      ])

      return {
        id: `agent-round-${round.round}`,
        label: `第${round.round}轮`,
        title: round.title,
        fact: roundEvidence.length
          ? `本轮获取 ${roundEvidence.length} 条新证据。`
          : '本轮基于已有证据继续推理。',
        reasoning: [
          round.reasoning,
          ...(round.tool_calls.length
            ? [`调用：${round.tool_calls.join('、')}`]
            : []),
        ],
        conclusion:
          index === rounds.length - 1 && run.status === 'done'
            ? (perspectiveView?.conclusion ?? run.conclusion).suggestion
            : round.reasoning,
        evidence: roundEvidence,
      }
    })
  }

  const timelineText = (start: number, end: number) =>
    timeline
      .slice(start, end)
      .map((item) => `${item.title}：${item.description}`)

  return [
    {
      id: 'round-1',
      label: '第一轮',
      title: '异常事实确认',
      fact:
        timelineText(0, 2).join(' ') ||
        `${run.robot} 上报“${run.event_type}”，开始核对事件与直接证据。`,
      reasoning: [
        '确认事件发生时刻、机器人与任务上下文。',
        '筛选超过安全阈值的遥测、日志与状态变化。',
        evidence[0]?.impact ?? '等待更多 Agent 证据补充异常范围。',
      ],
      conclusion:
        evidence[0]?.impact ?? '已确认存在与本次事件直接相关的异常信号。',
      evidence: evidence.slice(0, 2),
    },
    {
      id: 'round-2',
      label: '第二轮',
      title: '因果链路关联',
      fact:
        timelineText(2, 4).join(' ') ||
        evidence[1]?.excerpt ||
        '将异常指标与执行链路中的代码、配置和日志进行关联。',
      reasoning: [
        '沿事件时间线对齐传感器、地图更新与控制指令。',
        evidence[1]?.impact ?? '定位异常信号影响的下游执行模块。',
        evidence[2]?.impact ?? '用独立日志证据交叉验证当前假设。',
      ],
      conclusion:
        evidence[2]?.impact ?? '异常信号已传导至控制链路，初步因果关系成立。',
      evidence: evidence.slice(1, 3),
    },
    {
      id: 'round-3',
      label: '第三轮',
      title: '根因与处置收敛',
      fact: (perspectiveView?.conclusion ?? run.conclusion).fact,
      reasoning: [
        (perspectiveView?.conclusion ?? run.conclusion).reasoning,
        evidence[3]?.impact ?? '检查配置项是否放大了异常影响。',
        `结合全部证据评估处置方向：${(perspectiveView?.conclusion ?? run.conclusion).suggestion}`,
      ],
      conclusion: (perspectiveView?.conclusion ?? run.conclusion).reasoning,
      evidence: evidence.slice(2),
    },
  ]
}

export function EventDetailPage({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate()
  const tracero = useTracero()
  const isPreview =
    preview ||
    new URLSearchParams(window.location.search).get('preview') === 'rounds'

  if (!tracero.currentRun && isPreview) {
    return (
      <EventDetailContent
        run={{ ...mockCurrentRun, status: 'done', data_source: 'demo' }}
        status='done'
        role={tracero.role}
        onRoleChange={tracero.setRole}
      />
    )
  }

  if (!tracero.currentRun) {
    return (
      <div className='flex h-full min-h-0 flex-col'>
        <Header fixed>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate({ to: '/tracero' })}
            aria-label='返回推理总览'
          >
            <ChevronLeft className='size-5' />
          </Button>
          <h1 className='text-lg font-semibold sm:text-xl'>当前推理</h1>
          <div className='flex-1' />
          <Button type='button' variant='outline' disabled>
            <Download className='size-4' />
            <span className='hidden sm:inline'>导出 Bug 报告</span>
          </Button>
          <ThemeSwitch />
        </Header>
        <Main className='flex flex-1 items-center justify-center'>
          <div className='max-w-md text-center'>
            {tracero.isLoadingCurrentRun ? (
              <>
                <Loader2 className='mx-auto size-7 animate-spin text-muted-foreground' />
                <p className='mt-3 text-sm text-muted-foreground'>
                  正在等待后端 Agent 推理记录...
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className='mx-auto size-7 text-amber-500' />
                <p className='mt-3 text-sm font-medium'>
                  等待 Agent 上报障碍事件
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {tracero.error ?? '事件到达后，页面会自动显示真实推理结果。'}
                </p>
                <Button
                  type='button'
                  variant='outline'
                  className='mt-4'
                  onClick={() => void tracero.loadCurrentRun()}
                >
                  重新加载
                </Button>
              </>
            )}
          </div>
        </Main>
      </div>
    )
  }

  return (
    <EventDetailContent
      run={tracero.currentRun}
      status={tracero.pushStatus}
      error={tracero.error}
      isLoading={tracero.isLoadingCurrentRun}
      role={tracero.role}
      onRoleChange={tracero.setRole}
    />
  )
}

export function EventDetailContent({
  run,
  status,
  error = null,
  isLoading = false,
  role,
  onRoleChange,
  backTo = '/tracero',
  title = '当前推理',
}: {
  run: TraceroRun
  status: AgentPushStatus
  error?: string | null
  isLoading?: boolean
  role: UserRole
  onRoleChange?: (role: UserRole) => void
  backTo?: '/tracero' | '/tracero/history'
  title?: string
}) {
  const navigate = useNavigate()
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [includeDemoAnalysis, setIncludeDemoAnalysis] = useState(false)
  const perspectiveView = run.perspective_view
  const showLiveDeveloperView = ENABLE_LIVE_DEVELOPER_VIEW && role === 'dev'
  const rounds = buildPreviewRounds(run)
  const laymanSummary = useMemo(() => buildLaymanSummary(run), [run])
  const supportingEvidenceCount = useMemo(
    () => countSupportingEvidence(run),
    [run]
  )
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(
    rounds.length - 1
  )
  const [followUp, setFollowUp] = useState('')
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null)
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const selectedRound = rounds[selectedRoundIndex] ?? rounds[0]
  const emptyRound: ReasoningRound = {
    id: 'empty',
    label: '等待',
    title: '等待后端返回 Agent 轮次',
    fact: '后端尚未保存 reasoning_rounds。',
    reasoning: ['前端不会用 timeline 生成伪造轮次。'],
    conclusion: '等待后端 Agent 推理轮次。',
    evidence: [],
  }
  const hasDemoContent = hasDemoReportContent(run, role)
  const isComplete = run.status === 'done'
  const canExport = isComplete && !isLoading

  async function handleFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = followUp.trim()
    if (!question || isSendingFollowUp) return
    setIsSendingFollowUp(true)
    setFollowUpError(null)
    try {
      setFollowUpAnswer(await askRunQuestion(run, question, role))
      setFollowUp('')
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : '追问发送失败')
    } finally {
      setIsSendingFollowUp(false)
    }
  }

  function handleExport() {
    downloadBugReport(run, role, { includeDemoAnalysis })
    setIsExportOpen(false)
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <Header fixed>
        <div className='flex min-w-0 items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate({ to: backTo })}
            aria-label={
              backTo === '/tracero/history' ? '返回历史记录' : '返回推理总览'
            }
          >
            <ChevronLeft className='size-5' />
          </Button>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-semibold sm:text-xl'>
              {title} - {run.event_type}
            </h1>
            <div className='flex min-w-0 items-center gap-2'>
              <p className='truncate text-sm text-muted-foreground'>
                {run.robot} · {run.trigger_time} · {run.run_id}
              </p>
              {run.data_source && (
                <Badge variant='outline' className='shrink-0'>
                  {run.data_source === 'robot'
                    ? '真实数据'
                    : run.data_source === 'demo'
                      ? 'Demo 数据'
                      : run.data_source === 'direct'
                        ? '直传证据'
                        : '历史数据'}
                </Badge>
              )}
              {run.data_provenance?.rich_analysis === 'demo' && (
                <Badge variant='secondary' className='shrink-0'>
                  富结构为示例
                </Badge>
              )}
            </div>
            {run.event_id ? (
              <p className='truncate font-mono text-xs text-muted-foreground'>
                Event ID: {run.event_id}
              </p>
            ) : null}
          </div>
        </div>
        <div className='flex-1' />
        <select
          value={role}
          onChange={(event) => {
            const nextRole = event.target.value as UserRole
            if (ENABLE_LIVE_DEVELOPER_VIEW) onRoleChange?.(nextRole)
            navigate({ to: '/tracero/current', search: { role: nextRole } })
          }}
          aria-label='选择视角'
          className='h-9 rounded-md border bg-background px-2 text-sm'
        >
          <option value='general'>通用</option>
          <option value='dev'>开发</option>
          <option value='test'>测试</option>
          <option value='ops'>运维</option>
        </select>
        <Button
          type='button'
          variant='outline'
          disabled={!canExport}
          onClick={() => setIsExportOpen(true)}
        >
          <Download className='size-4' />
          <span className='hidden sm:inline'>导出 Bug 报告</span>
        </Button>
        <ThemeSwitch />
      </Header>

      <Main
        fixed
        fluid
        className='min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 md:p-5'
      >
        <div className='mx-auto flex min-h-full w-full max-w-[1800px] flex-col gap-3'>
          <ReasoningStatusBar
            status={status}
            error={error}
            rounds={rounds}
            selectedRoundIndex={selectedRoundIndex}
            onSelectRound={setSelectedRoundIndex}
          />

          <ReplayStrip run={run} />

          <div
            className={cn(
              'overflow-hidden border bg-background/80 shadow-sm',
              showLiveDeveloperView
                ? 'h-[720px] min-h-[720px] lg:h-[560px] lg:min-h-[560px] xl:h-[620px] xl:min-h-[620px]'
                : role === 'test'
                  ? 'h-[760px] min-h-[760px] overflow-hidden'
                  : role === 'ops'
                    ? 'h-[720px] min-h-[720px] overflow-hidden'
                  : 'h-[390px] min-h-[390px]'
            )}
          >
            {role === 'general' ? (
              <ResizablePanels
                left={<RoundEvidencePanel round={selectedRound ?? emptyRound} />}
                middle={
                  <RoundReasoningPanel round={selectedRound ?? emptyRound} />
                }
                right={
                  <RoundConclusionPanel round={selectedRound ?? emptyRound} />
                }
              />
            ) : showLiveDeveloperView ? (
              <LiveDeveloperView run={run} />
            ) : role === 'test' ? (
              <TestPerspectivePanel run={run} round={selectedRound ?? emptyRound} />
            ) : role === 'ops' ? (
              <OpsPerspectivePanel run={run} round={selectedRound ?? emptyRound} />
            ) : (
              <PerspectiveRolePanel
                run={run}
                role={role}
                round={selectedRound ?? emptyRound}
              />
            )}
          </div>

          <section className='grid shrink-0 gap-3 border bg-background/95 p-4 shadow-sm lg:grid-cols-[180px_1fr] lg:items-center'>
            <div className='flex items-center gap-3'>
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-md text-white',
                  isComplete ? 'bg-emerald-600' : 'bg-violet-600'
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className='size-5' />
                ) : (
                  <Loader2 className='size-5 animate-spin' />
                )}
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>
                  DeepSeek 推理结果
                </p>
                <p className='mt-0.5 text-sm font-semibold'>
                  {isComplete ? '证据校验已通过' : '结果仍在轮询更新'}
                </p>
              </div>
            </div>
            <div className='min-w-0 border-l-0 text-sm leading-6 lg:border-l lg:pl-5'>
              <p className='font-medium text-foreground'>{laymanSummary}</p>
              <p className='mt-2 text-xs text-muted-foreground'>
                置信度 {inferConfidence(run)}% · 支撑证据 {supportingEvidenceCount} 条 · 耗时{' '}
                {inferElapsed(run)}
              </p>
              <Collapsible className='mt-2'>
                <CollapsibleTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-7 gap-1 px-2 text-xs text-muted-foreground'
                  >
                    <ArrowRight className='size-3.5' />
                    技术细节
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='mt-2 space-y-2 text-sm leading-6'>
                  <p className='text-muted-foreground'>
                    {(perspectiveView?.conclusion ?? run.conclusion).reasoning}
                  </p>
                  <p className='text-emerald-700 dark:text-emerald-300'>
                    {(perspectiveView?.conclusion ?? run.conclusion).suggestion}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </section>

          {followUpAnswer && (
            <div className='border bg-background/95 p-3 text-sm leading-6 shadow-sm'>
              <p className='mb-1 font-medium text-muted-foreground'>AI 回复</p>
              <p className='whitespace-pre-line'>{followUpAnswer}</p>
            </div>
          )}
          {followUpError && (
            <p className='px-1 text-sm text-destructive'>{followUpError}</p>
          )}
          <form
            className='flex shrink-0 items-end gap-3 border bg-background/95 p-3 shadow-sm'
            onSubmit={handleFollowUp}
          >
            <div className='flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground'>
              <MessageSquareText className='size-5' />
            </div>
            <Textarea
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder='继续追问当前推理...'
              className='min-h-10 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
              rows={1}
            />
            <Button
              type='submit'
              size='icon'
              disabled={!followUp.trim() || isSendingFollowUp}
              title='发送追问'
              aria-label='发送追问'
            >
              {isSendingFollowUp ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Send />
              )}
            </Button>
          </form>
        </div>
      </Main>
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出 Bug 报告</DialogTitle>
            <DialogDescription>
              默认排除示例结论、证据和富结构分析，并在报告中保留逐部分数据来源。
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-2 rounded-md border bg-muted/30 p-3 text-sm'>
            <div className='flex items-center justify-between gap-4'>
              <span className='text-muted-foreground'>Run ID</span>
              <span className='truncate font-mono text-xs'>{run.run_id}</span>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <span className='text-muted-foreground'>事件与结论</span>
              <Badge variant='outline'>
                {run.data_provenance?.conclusion === 'backend'
                  ? '后端真实数据'
                  : run.data_provenance?.conclusion === 'legacy'
                    ? '历史数据'
                    : '示例数据'}
              </Badge>
            </div>
          </div>

          {hasDemoContent && (
            <label className='flex cursor-pointer items-start gap-3 rounded-md border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20'>
              <Checkbox
                className='mt-0.5'
                checked={includeDemoAnalysis}
                onCheckedChange={(checked) =>
                  setIncludeDemoAnalysis(checked === true)
                }
              />
              <span className='min-w-0'>
                <span className='block text-sm font-medium'>包含示例分析</span>
                <span className='mt-1 block text-xs leading-5 text-muted-foreground'>
                  示例证据或富结构会被醒目标记，不应直接用于生产处置或缺陷归因。
                </span>
              </span>
            </label>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsExportOpen(false)}
            >
              取消
            </Button>
            <Button type='button' onClick={handleExport}>
              <Download />
              确认导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TestPerspectivePanel({
  run,
  round,
}: {
  run: TraceroRun
  round: ReasoningRound
}) {
  const [showAllEvidence, setShowAllEvidence] = useState(false)
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const evidence = mergeEvidenceByQuality([
    ...(run.perspective_view?.evidence ?? []),
    ...Object.values(run.perspective_view?.evidence_by_type ?? {}).flat(),
    ...(run.evidence ?? []),
    ...round.evidence,
  ])
  const testEvidence = evidence.filter((item) =>
    ['log', 'metric', 'config', 'code'].includes(item.type)
  )
  const modules = [...new Set(
    evidence.flatMap((item) => {
      const raw = item as Record<string, unknown>
      return [raw.module, ...(Array.isArray(raw.related_modules) ? raw.related_modules : [])]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    })
  )]

  return (
    <div className='flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(14,165,233,0.08),transparent_45%)] p-4'>
      <div className='grid gap-2 sm:grid-cols-3'>
        <TestMetric label='关联证据' value={`${testEvidence.length}`} />
        <TestMetric label='运行时信号' value={`${testEvidence.filter((item) => item.type === 'log' || item.type === 'metric').length}`} />
        <TestMetric label='归因模块' value={modules.length ? `${modules.length}` : '暂无数据'} />
      </div>
      <div className='mt-3 grid gap-3 lg:grid-cols-3'>
        <TestSummaryCard title='归因' content={modules.length ? modules.join('、') : '暂无模块归因数据'} />
        <TestSummaryCard title='验证' content={conclusion.reasoning || '暂无验证建议'} />
        <TestSummaryCard title='任务' content='暂无任务负责人、优先级和状态数据' />
      </div>
      <div className='mt-3 grid min-h-[440px] shrink-0 gap-3 overflow-visible lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]'>
        <section className='flex h-[440px] min-h-0 min-w-0 flex-col rounded-md border bg-background/90 p-3'>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <h3 className='text-sm font-semibold text-sky-950 dark:text-sky-100'>复现证据</h3>
              <p className='mt-1 text-xs text-muted-foreground'>运行时、参数、消息链路和代码证据</p>
            </div>
            <Badge variant='outline'>{testEvidence.length} 条</Badge>
          </div>
          <div className='mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
            {testEvidence.length ? (
              <>
                {(showAllEvidence ? testEvidence : testEvidence.slice(0, 2)).map((item) => (
                  <EvidenceCard key={item.evidence_id} item={item} label='对复现的作用' />
                ))}
                {testEvidence.length > 2 && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-full border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30'
                    onClick={() => setShowAllEvidence((current) => !current)}
                  >
                    {showAllEvidence ? '收起其余证据' : `查看全部证据（${testEvidence.length} 条）`}
                  </Button>
                )}
              </>
            ) : <EmptyTestState text='暂无可用于复现的证据' />}
          </div>
        </section>
        <div className='grid h-[440px] min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden'>
          <section className='min-h-0 overflow-y-auto rounded-md border bg-background/90 p-3'>
            <h3 className='text-sm font-semibold text-sky-950 dark:text-sky-100'>受影响功能</h3>
            <div className='mt-2 flex flex-wrap gap-2'>
              {modules.length ? modules.map((module) => <Badge key={module} variant='secondary'>{module}</Badge>) : <span className='text-xs text-muted-foreground'>暂无数据</span>}
            </div>
          </section>
          <section className='min-h-0 overflow-y-auto rounded-md border bg-background/90 p-3'>
            <h3 className='text-sm font-semibold text-sky-950 dark:text-sky-100'>验证建议</h3>
            <p className='mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground'>{conclusion.suggestion || '暂无数据'}</p>
          </section>
        </div>
      </div>
      <section className='mt-3 rounded-md border border-sky-200 bg-sky-50/70 p-3 text-sm leading-6 dark:border-sky-900/70 dark:bg-sky-950/20'>
        <p className='font-semibold text-sky-950 dark:text-sky-100'>测试结论</p>
        <p className='mt-1'>{conclusion.fact || '暂无数据'}</p>
      </section>
    </div>
  )
}

function TestMetric({ label, value }: { label: string; value: string }) {
  return <div className='rounded-md border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/70 dark:bg-sky-950/20'><p className='text-xs text-muted-foreground'>{label}</p><strong className='mt-1 block text-2xl text-sky-700 dark:text-sky-300'>{value}</strong></div>
}

function TestSummaryCard({ title, content }: { title: string; content: string }) {
  return <section className='min-w-0 rounded-md border border-sky-200 bg-background/90 p-3'><h3 className='text-sm font-semibold'>{title}</h3><p className='mt-2 min-w-0 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground'>{content || '暂无数据'}</p></section>
}

function EvidenceCard({ item, label }: { item: NonNullable<TraceroRun['evidence']>[number]; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type='button' className='block h-auto min-h-[170px] w-full min-w-0 rounded-md border bg-card p-3 text-left transition-colors hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-sky-950/20'>
          <div className='flex items-center justify-between gap-2'>
            <strong className='truncate text-xs'>{item.title}</strong>
            <Badge variant='secondary' className='shrink-0 font-mono text-[10px]'>{item.evidence_id}</Badge>
          </div>
          <p className='mt-1 truncate text-[11px] text-muted-foreground'>{item.source}</p>
          <pre className='mt-2 max-h-52 w-full overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-xs leading-5 text-muted-foreground'>{item.excerpt || '暂无具体证据内容'}</pre>
          <p className='mt-2 text-xs leading-5 text-sky-800 dark:text-sky-200'>{label}：{item.impact || '暂无影响说明'}</p>
        </button>
      </TooltipTrigger>
      <TooltipContent side='right' align='start' className='max-w-[min(520px,calc(100vw-2rem))] space-y-2 text-left'>
        <p className='font-semibold'>{item.title} · {item.evidence_id}</p>
        <p className='font-mono text-[11px] text-muted-foreground'>{item.source}</p>
        <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px] leading-5'>{item.excerpt || '暂无具体证据内容'}</pre>
        <p className='text-xs leading-5'><span className='font-semibold'>{label}：</span>{item.impact || '暂无影响说明'}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function EmptyTestState({ text }: { text: string }) {
  return <p className='rounded border border-dashed p-3 text-xs text-muted-foreground'>{text}</p>
}

function OpsPerspectivePanel({ run, round }: { run: TraceroRun; round: ReasoningRound }) {
  const [showAllEvidence, setShowAllEvidence] = useState(false)
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const evidence = mergeEvidenceByQuality([
    ...(run.perspective_view?.evidence ?? []),
    ...Object.values(run.perspective_view?.evidence_by_type ?? {}).flat(),
    ...(run.evidence ?? []),
    ...round.evidence,
  ])
  const opsEvidence = evidence.filter((item) => ['log', 'metric', 'config'].includes(item.type))
  const runtime = opsEvidence.filter((item) => item.type === 'log' || item.type === 'metric')
  const modules = [...new Set(evidence.flatMap((item) => {
    const raw = item as Record<string, unknown>
    return [raw.module, ...(Array.isArray(raw.related_modules) ? raw.related_modules : [])].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }))]
  const shownEvidence = showAllEvidence ? opsEvidence : opsEvidence.slice(0, 2)

  return (
    <div className='flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(245,158,11,0.1),transparent_45%)] p-4'>
      <div className='grid gap-2 sm:grid-cols-3'>
        <OpsMetric label='运行证据' value={`${runtime.length}`} />
        <OpsMetric label='关联证据' value={`${opsEvidence.length}`} />
        <OpsMetric label='影响模块' value={modules.length ? `${modules.length}` : '暂无数据'} />
      </div>
      <div className='mt-3 grid gap-3 lg:grid-cols-3'>
        <OpsSummary title='事件摘要' content={conclusion.fact} />
        <OpsSummary title='业务影响' content={conclusion.reasoning} />
        <OpsSummary title='处置建议' content={conclusion.suggestion} />
      </div>
      <div className='mt-3 grid h-[400px] min-h-[400px] shrink-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]'>
        <section className='flex h-[400px] min-h-0 min-w-0 flex-col rounded-md border border-amber-200 bg-background/90 p-3 dark:border-amber-900/70'>
          <div className='flex items-center justify-between gap-2'>
            <div><h3 className='text-sm font-semibold text-amber-950 dark:text-amber-100'>运维证据</h3><p className='mt-1 text-xs text-muted-foreground'>运行时、日志和指标</p></div>
            <Badge variant='outline'>{opsEvidence.length} 条</Badge>
          </div>
          <div className='mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
            {shownEvidence.length ? shownEvidence.map((item) => <EvidenceCard key={item.evidence_id} item={item} label='对运行的影响' />) : <EmptyTestState text='暂无运维证据' />}
            {opsEvidence.length > 2 && <Button type='button' variant='outline' size='sm' className='w-full border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300' onClick={() => setShowAllEvidence((value) => !value)}>{showAllEvidence ? '收起其余证据' : `查看全部运维证据（${opsEvidence.length} 条）`}</Button>}
          </div>
        </section>
        <div className='grid h-[400px] min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden'>
          <section className='min-h-0 overflow-y-auto rounded-md border bg-background/90 p-3'><h3 className='text-sm font-semibold text-amber-950 dark:text-amber-100'>受影响模块与功能</h3><div className='mt-2 flex flex-wrap gap-2'>{modules.length ? modules.map((module) => <Badge key={module} variant='secondary'>{module}</Badge>) : <span className='text-xs text-muted-foreground'>暂无数据</span>}</div></section>
          <section className='min-h-0 overflow-y-auto rounded-md border bg-background/90 p-3'><h3 className='text-sm font-semibold text-amber-950 dark:text-amber-100'>恢复判断</h3><p className='mt-2 text-sm leading-6 text-muted-foreground'>恢复条件：暂无数据</p><p className='mt-1 text-sm leading-6 text-muted-foreground'>值班负责人：暂无数据</p><p className='mt-1 text-sm leading-6 text-muted-foreground'>工单：暂无数据</p></section>
        </div>
      </div>
    </div>
  )
}

function OpsMetric({ label, value }: { label: string; value: string }) { return <div className='rounded-md border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/70 dark:bg-amber-950/20'><p className='text-xs text-muted-foreground'>{label}</p><strong className='mt-1 block text-2xl text-amber-700 dark:text-amber-300'>{value}</strong></div> }
function OpsSummary({ title, content }: { title: string; content: string }) {
  const [showAll, setShowAll] = useState(false)
  const value = content || '暂无数据'

  return (
    <section className='flex h-[180px] min-w-0 flex-col rounded-md border border-amber-200 bg-background/90 p-3'>
      <h3 className='shrink-0 text-sm font-semibold'>{title}</h3>
      <div className={cn('mt-2 min-h-0 flex-1 text-sm leading-6 text-muted-foreground', showAll ? 'overflow-y-auto pr-1' : 'overflow-hidden')}>
        <p className={cn('whitespace-pre-line break-words', !showAll && 'line-clamp-4')}>{value}</p>
      </div>
      <button
        type='button'
        className='mt-2 shrink-0 self-start text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-300'
        onClick={() => setShowAll((current) => !current)}
      >
        {showAll ? '收起内容' : '查看全部'}
      </button>
    </section>
  )
}

function PerspectiveRolePanel({
  run,
  role,
  round,
}: {
  run: TraceroRun
  role: Exclude<UserRole, 'general'>
  round: ReasoningRound
}) {
  const labels = { dev: '开发视角', test: '测试视角', ops: '运维视角' }
  const focus = run.perspective_view?.focus || '当前视角证据与结论'
  const conclusion = run.perspective_view?.conclusion ?? run.conclusion
  const allEvidence = mergeEvidenceByQuality([
    ...(run.perspective_view?.evidence ?? []),
    ...Object.values(run.perspective_view?.evidence_by_type ?? {}).flat(),
    ...(run.evidence ?? []),
    ...round.evidence,
  ])
  const evidenceTypes = {
    dev: ['code', 'config', 'log'],
    test: ['code', 'config', 'log'],
    ops: ['log', 'metric'],
  }
  const filteredEvidence = allEvidence.filter((item) =>
    evidenceTypes[role].includes(String(item.type))
  )
  const visibleEvidence = filteredEvidence.length ? filteredEvidence : allEvidence
  const sectionTitle = role === 'test' ? '验证证据' : '运行态势与影响'
  const sectionDescription =
    role === 'test'
      ? '基于运行时、参数和消息链路证据组织验证范围。'
      : '基于运行时、日志和指标证据组织影响与处置判断。'

  return (
    <div className='grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_1fr]'>
      <div className='min-h-0 overflow-auto border-r p-4'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <div>
            <h2 className='text-sm font-semibold'>{labels[role]} · {focus}</h2>
            <p className='mt-1 text-xs text-muted-foreground'>{sectionDescription}</p>
          </div>
          <Badge variant='outline'>{visibleEvidence.length} 条证据</Badge>
        </div>
        <div className='space-y-2'>
          {visibleEvidence.length ? visibleEvidence.map((item) => (
            <article key={item.evidence_id} className='rounded-md border bg-card p-3'>
              <div className='flex items-center justify-between gap-2'>
                <strong className='text-xs'>{item.title}</strong>
                <Badge variant='secondary' className='font-mono text-[10px]'>{item.evidence_id}</Badge>
              </div>
              <p className='mt-1 text-[11px] text-muted-foreground'>{item.source}</p>
              <pre className='mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px] leading-5'>
                {item.excerpt || item.impact || '暂无具体证据内容'}
              </pre>
            </article>
          )) : (
            <p className='text-sm text-muted-foreground'>当前视角暂无可展示证据。</p>
          )}
        </div>
      </div>
      <div className='min-h-0 overflow-auto p-4'>
        <h2 className='text-sm font-semibold'>{sectionTitle}</h2>
        <div className='mt-3 grid gap-3 text-sm leading-6'>
          <p><strong>事实：</strong>{conclusion.fact}</p>
          <p><strong>推理：</strong>{conclusion.reasoning}</p>
          <p className='text-emerald-700 dark:text-emerald-300'><strong>建议：</strong>{conclusion.suggestion}</p>
          <div className='rounded-md border bg-muted/20 p-3'>
            <p className='text-xs font-semibold text-muted-foreground'>本视角证据摘要</p>
            <div className='mt-2 flex flex-wrap gap-2'>
              {Object.entries(
                visibleEvidence.reduce<Record<string, number>>((counts, item) => {
                  counts[String(item.type)] = (counts[String(item.type)] ?? 0) + 1
                  return counts
                }, {})
              ).map(([type, count]) => (
                <Badge key={type} variant='secondary'>{type}: {count}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoundEvidencePanel({ round }: { round: ReasoningRound }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const sortedEvidence = sortEvidence(round.evidence)
  const groups = [
    {
      type: 'log' as const,
      label: '日志',
      items: sortedEvidence.filter((item) =>
        ['log', 'runtime'].includes(item.type)
      ),
    },
    {
      type: 'code' as const,
      label: '代码',
      items: sortedEvidence.filter((item) =>
        ['code', 'source_code'].includes(item.type)
      ),
    },
    {
      type: 'metric' as const,
      label: '指标',
      items: sortedEvidence.filter((item) => item.type === 'metric'),
    },
    {
      type: 'config' as const,
      label: '配置',
      items: sortedEvidence.filter((item) =>
        ['config', 'parameter', 'message_mapping'].includes(item.type)
      ),
    },
  ].filter((group) => group.items.length > 0)

  return (
    <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
      <CardHeader className='shrink-0 border-b py-3'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <FileText className='size-4 text-sky-600' />
          这一轮的事实
          <Badge variant='outline' className='ml-auto text-[10px]'>
            本轮共 {round.evidence.length} 条证据
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className='min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-hidden p-0'>
        <ScrollArea className='h-full'>
          <div className='max-w-full min-w-0 space-y-3 p-4 pr-6'>
            {round.fact && (
              <p className='text-sm leading-6 text-muted-foreground'>
                {round.fact}
              </p>
            )}
            {groups.length ? (
              groups.map((group) => {
                const isExpanded = expandedGroups.has(group.type)
                const visibleItems = isExpanded
                  ? group.items
                  : group.items.slice(0, 3)

                return (
                  <section
                    key={group.type}
                    className='group rounded-md border bg-muted/10'
                  >
                    <div className='flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold'>
                      <span className='flex items-center gap-2'>
                        <span className='text-sky-700 dark:text-sky-300'>
                          {group.label}
                        </span>
                        <span className='font-normal text-muted-foreground'>
                          {group.items.length} 条证据
                        </span>
                      </span>
                      <GroupEvidenceBadge group={group} />
                    </div>
                    <div className='min-w-0 space-y-2 overflow-hidden border-t p-2'>
                      {visibleItems.map((item, itemIndex) => (
                        <section
                          key={`${item.evidence_id}-${itemIndex}`}
                          className='max-w-full min-w-0 overflow-hidden rounded-md border bg-background p-3'
                        >
                          <div className='flex items-start justify-between gap-2'>
                            <div className='min-w-0'>
                              <h3 className='text-xs font-semibold'>
                                {item.title}
                              </h3>
                              <p className='mt-1 text-[10px] text-muted-foreground'>
                                {group.label} · 本轮新增证据
                              </p>
                            </div>
                            <Badge
                              variant='secondary'
                              className='mr-1 max-w-24 shrink-0 overflow-hidden font-mono text-[10px] text-ellipsis whitespace-nowrap'
                              title={item.evidence_id}
                            >
                              {item.evidence_id}
                            </Badge>
                          </div>
                          <p className='mt-1 max-w-full font-mono text-[10px] break-all text-muted-foreground'>
                            {item.source}
                          </p>
                          {item.excerpt && (
                            <pre className='mt-2 max-h-48 max-w-full overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-5 break-all whitespace-pre-wrap'>
                              {item.excerpt}
                            </pre>
                          )}
                        </section>
                      ))}
                      {group.items.length > 3 ? (
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='w-full justify-center gap-2 text-xs text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200'
                          onClick={() => {
                            setExpandedGroups((current) => {
                              const next = new Set(current)
                              if (next.has(group.type)) next.delete(group.type)
                              else next.add(group.type)
                              return next
                            })
                          }}
                        >
                          <List className='size-3.5' />
                          {isExpanded
                            ? '收起本类证据'
                            : `查看全部 ${group.items.length} 条${group.label}证据`}
                        </Button>
                      ) : null}
                    </div>
                  </section>
                )
              })
            ) : (
              <p className='text-sm text-muted-foreground'>
                后端尚未返回本轮的具体日志、代码或指标证据。
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function RoundReasoningPanel({ round }: { round: ReasoningRound }) {
  return (
    <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
      <CardHeader className='shrink-0 border-b py-3'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <BrainCircuit className='size-4 text-violet-600' />
          这一轮的推理过程
        </CardTitle>
      </CardHeader>
      <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
        <ScrollArea className='h-full'>
          <ol className='space-y-3 p-4'>
            {round.reasoning.map((item, index) => (
              <li key={item} className='flex gap-3 text-sm leading-6'>
                <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300'>
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function RoundConclusionPanel({ round }: { round: ReasoningRound }) {
  return (
    <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
      <CardHeader className='shrink-0 border-b py-3'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Lightbulb className='size-4 text-emerald-600' />
          这一轮的推理结论
        </CardTitle>
      </CardHeader>
      <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
        <ScrollArea className='h-full'>
          <div className='p-4'>
            <div className='rounded-md border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 dark:border-emerald-900/70 dark:bg-emerald-950/25'>
              {round.conclusion}
            </div>
            <div className='mt-4 flex items-center gap-2 text-xs text-muted-foreground'>
              <ArrowRight className='size-3.5' />
              结论会带入下一轮继续验证
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ReplayStrip({ run }: { run: TraceroRun }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [frame, setFrame] = useState(0)

  const evidenceCount = run.perspective_view?.evidence?.length ?? run.evidence?.length ?? 0
  const obstacleDistance = inferObstacleDistance(run)
  const obstacleRadius = inferObstacleRadius(run)
  const unsafeThreshold = 0.65
  const totalFrames = 72
  const progress = frame / (totalFrames - 1)
  const approach = Math.min(1, progress * 1.15)
  const currentDistance = Math.max(
    unsafeThreshold * 0.58,
    obstacleDistance - approach * 0.55
  )
  const isUnsafe = currentDistance <= unsafeThreshold

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % totalFrames)
    }, 80)
    return () => window.clearInterval(timer)
  }, [isPlaying, totalFrames])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const robotX = 112
    const robotY = 92
    const robotWidth = 72
    const robotHeight = 42
    const obstacleY = 90
    const obstacleWidth = 54 + obstacleRadius * 42
    const obstacleHeight = 30 + obstacleRadius * 18
    const obstacleBaseX = 720
    const obstacleX = obstacleBaseX - approach * 160

    ctx.clearRect(0, 0, width, height)

    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#020617')
    bg.addColorStop(1, '#0f172a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(148,163,184,0.16)'
    ctx.lineWidth = 1
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(99,102,241,0.18)'
    ctx.fillRect(80, 72, width - 160, 48)

    ctx.fillStyle = 'rgba(34,197,94,0.92)'
    ctx.fillRect(robotX, robotY, robotWidth, robotHeight)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px monospace'
    ctx.fillText('robot', robotX + 12, robotY + 26)

    ctx.fillStyle = isUnsafe ? 'rgba(251,146,60,0.92)' : 'rgba(56,189,248,0.92)'
    ctx.fillRect(obstacleX, obstacleY, obstacleWidth, obstacleHeight)

    ctx.strokeStyle = isUnsafe ? 'rgba(251,191,36,0.95)' : 'rgba(125,211,252,0.95)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(robotX + robotWidth, 93)
    ctx.lineTo(obstacleX, 93)
    ctx.stroke()

    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(
      `阈值 0.65m`,
      robotX + 118,
      78
    )
    ctx.fillText(
      isUnsafe ? '安全阈值已触发' : '继续接近中',
      obstacleX - 12,
      82
    )
  }, [approach, canvasRef, isUnsafe, obstacleRadius])

  return (
    <section className='grid gap-3 border bg-background/95 p-4 shadow-sm lg:grid-cols-[1fr_280px]'>
      <div className='min-w-0'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <div>
            <p className='text-xs font-medium text-muted-foreground'>Canvas 2D 回放</p>
            <h3 className='text-sm font-semibold'>故障前后位置关系</h3>
          </div>
          <Button type='button' variant='outline' size='sm' onClick={() => setIsPlaying((current) => !current)}>
            {isPlaying ? '暂停' : '播放'}
          </Button>
        </div>
        <div className='overflow-hidden rounded-md border bg-slate-950'>
          <canvas
            ref={canvasRef}
            width={980}
            height={180}
            className='h-[180px] w-full'
            aria-label='故障回放动图'
          />
        </div>
      </div>
      <div className='grid gap-2 text-xs'>
        {[
          ['障碍物阈值', `${unsafeThreshold.toFixed(2)}m`],
          ['当前推断距离', `${currentDistance.toFixed(2)}m`],
          ['障碍物尺寸', `${(54 + obstacleRadius * 42).toFixed(0)} × ${(30 + obstacleRadius * 18).toFixed(0)} px`],
          ['回放证据', `${evidenceCount} 条`],
        ].map(([label, value]) => (
          <div key={label} className='rounded-md border bg-muted/20 p-2'>
            <p className='text-muted-foreground'>{label}</p>
            <p className='mt-1 font-mono font-medium'>{value}</p>
          </div>
        ))}
        <div className={cn('rounded-md border p-2', isUnsafe ? 'border-amber-300 bg-amber-50/70' : 'bg-muted/20')}>
          <p className='text-muted-foreground'>当前状态</p>
          <p className='mt-1 font-medium'>
            {isUnsafe ? '障碍物进入安全阈值，系统应减速' : '仍在安全距离内'}
          </p>
        </div>
      </div>
    </section>
  )
}

function GroupEvidenceBadge({
  group,
}: {
  group: {
    items: NonNullable<TraceroRun['evidence']>
  }
}) {
  const evidenceIds = group.items.map((item) => item.evidence_id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant='secondary'
          className='text-[10px] font-mono'
        >
          证据 ×{evidenceIds.length}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className='max-w-80 text-left'>
        <div className='space-y-1'>
          <p className='font-semibold'>证据链列表</p>
          <p className='font-mono text-[11px] leading-5'>
            {evidenceIds.join(' · ')}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function ReasoningStatusBar({
  status,
  error,
  rounds,
  selectedRoundIndex,
  onSelectRound,
}: {
  status: AgentPushStatus
  error: string | null
  rounds: ReasoningRound[]
  selectedRoundIndex: number
  onSelectRound: (index: number) => void
}) {
  const labels: Record<AgentPushStatus, string> = {
    idle: '链路就绪',
    receiving: '正在接收事件',
    reasoning: '后端推理中',
    done: '推理完成',
    failed: '链路异常',
  }
  const descriptions: Record<AgentPushStatus, string> = {
    idle: '正在等待小车 Agent 上报障碍事件。',
    receiving: 'Agent 事件已到达后端，正在等待处理。',
    reasoning: '后端正在生成推理过程与结果。',
    done: 'DeepSeek 推理结果已返回，并通过后端证据引用校验。',
    failed: '请求失败，请检查 API 地址、跨域配置和响应数据结构。',
  }
  const isBusy = status === 'receiving' || status === 'reasoning'
  const progress =
    status === 'done'
      ? 100
      : status === 'reasoning'
        ? 62
        : status === 'receiving'
          ? 18
          : 0
  return (
    <section
      className={cn(
        'relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-lg border bg-background/95 p-3 shadow-sm',
        status === 'failed' &&
          'border-rose-300 bg-rose-50/60 dark:bg-rose-950/20'
      )}
    >
      <div className='flex items-center gap-3'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-full border bg-background'>
          {isBusy ? (
            <Loader2 className='size-5 animate-spin text-violet-600' />
          ) : status === 'done' ? (
            <CheckCircle2 className='size-5 text-emerald-600' />
          ) : (
            <Timer className='size-5 text-violet-600' />
          )}
        </div>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='font-semibold'>{labels[status]}</h2>
            <Badge variant='secondary'>
              {rounds.length === 1 ? 'DeepSeek 实时结果' : '多轮预览'}
            </Badge>
          </div>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            {descriptions[status]}
          </p>
          {error && <p className='mt-1 text-xs text-destructive'>{error}</p>}
        </div>
      </div>
      <div className='relative px-1 pt-1 sm:px-3'>
        <div className='absolute top-[18px] right-[8%] left-[8%] h-1 rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-500 transition-[width] duration-700'
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className='relative grid gap-2'
          style={{
            gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))`,
          }}
        >
          {rounds.map((round, index) => {
            const complete = status === 'done' || index < selectedRoundIndex
            const active = index === selectedRoundIndex
            return (
              <button
                key={round.id}
                type='button'
                onClick={() => onSelectRound(index)}
                className='group flex min-w-0 flex-col items-center gap-1.5 text-center'
              >
                <span
                  className={cn(
                    'relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold transition-all',
                    complete && 'border-violet-500 bg-violet-600 text-white',
                    active && 'border-violet-500 ring-4 ring-violet-500/15',
                    !complete && !active && 'text-muted-foreground'
                  )}
                >
                  {complete ? <CheckCircle2 className='size-4' /> : index + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-xs font-medium',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {round.label}
                </span>
                <span className='hidden truncate text-[10px] text-muted-foreground sm:block'>
                  {round.title}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
