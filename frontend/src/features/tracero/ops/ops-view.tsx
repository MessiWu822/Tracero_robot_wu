import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Megaphone,
  PlayCircle,
  RadioTower,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { mockCurrentRun } from '../mock-data'

type OpsAnalysis = typeof mockCurrentRun.opsAnalysis

const metricStyles = {
  critical:
    'border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/25',
  warning:
    'border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25',
  normal:
    'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25',
}

export function OpsView({ analysis }: { analysis: OpsAnalysis }) {
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  function toggleStep(stepId: string) {
    setCompletedSteps((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId]
    )
  }

  function executeAction(stepId: string, command: string) {
    setCompletedSteps((current) =>
      current.includes(stepId) ? current : [...current, stepId]
    )
    toast.success(`已执行：${command}`, {
      description: '当前为 Demo 状态，后续可接入运维控制 API。',
    })
  }

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.13),transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.98))]'>
      <div className='shrink-0 border-b border-amber-200/70 bg-background/75 p-3 backdrop-blur dark:border-amber-950/70 dark:bg-background/55'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/25'>
          <div className='flex items-center gap-2'>
            <div className='flex size-8 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm shadow-amber-300/70 dark:shadow-none'>
              <RadioTower className='size-4' />
            </div>
            <div>
              <h2 className='text-sm font-semibold text-amber-950 dark:text-amber-100'>
                运维指挥态势
              </h2>
              <p className='text-[11px] text-amber-800/80 dark:text-amber-200/80'>
                {analysis.startedAt} 接管 · {analysis.owner}
              </p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='destructive'>{analysis.severity}</Badge>
            <Badge className='bg-amber-600 text-white hover:bg-amber-600'>
              {analysis.status}
            </Badge>
          </div>
        </div>
        <div className='grid gap-2 xl:grid-cols-3'>
          <ConclusionItem
            icon={RadioTower}
            label='摘要'
            content={analysis.conclusion.summary}
            tone='sky'
          />
          <ConclusionItem
            icon={AlertTriangle}
            label='影响'
            content={analysis.conclusion.impact}
            tone='rose'
          />
          <ConclusionItem
            icon={ShieldCheck}
            label='预案'
            content={analysis.conclusion.response}
            tone='emerald'
          />
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
          <span className='flex items-center gap-1 text-muted-foreground'>
            <Clock3 className='size-3.5' />
            {analysis.startedAt} 开始 · 已持续 {analysis.elapsed}
          </span>
          <span className='flex items-center gap-1 text-muted-foreground'>
            <UsersRound className='size-3.5' />
            {analysis.owner}
          </span>
        </div>
      </div>

      <Tabs defaultValue='overview' className='min-h-0 min-w-0 flex-1 gap-0'>
        <div className='shrink-0 border-b border-amber-200/70 bg-white/65 px-3 py-2 backdrop-blur dark:border-amber-950/70 dark:bg-slate-950/35'>
          <TabsList className='grid w-full grid-cols-3 bg-amber-50/70 dark:bg-amber-950/30'>
            <TabsTrigger value='overview'>
              <CircleGauge />
              事件态势
            </TabsTrigger>
            <TabsTrigger value='response'>
              <Wrench />
              应急处置
            </TabsTrigger>
            <TabsTrigger value='recovery'>
              <CheckCircle2 />
              通知与恢复
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='overview' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-4 p-3'>
              <section>
                <h3 className='mb-2 text-sm font-semibold'>影响范围</h3>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {analysis.impactAreas.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-md border p-3 shadow-sm ${metricStyles[item.status]}`}
                    >
                      <p className='text-xs text-muted-foreground'>
                        {item.label}
                      </p>
                      <strong className='mt-1 block text-xl'>{item.value}</strong>
                      <p className='mt-1 text-xs leading-5'>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className='mb-2 text-sm font-semibold'>实时运行指标</h3>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {analysis.liveMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className='rounded-md border bg-card/90 p-3 shadow-sm'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <p className='text-xs text-muted-foreground'>
                            {metric.label}
                          </p>
                          <strong className='mt-1 block text-lg'>
                            {metric.value}
                          </strong>
                        </div>
                        <Activity
                          className={`size-4 ${
                            metric.status === 'critical'
                              ? 'text-rose-600'
                              : metric.status === 'warning'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        />
                      </div>
                      <p className='mt-2 text-xs text-muted-foreground'>
                        {metric.threshold}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value='response' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-2 p-3'>
              {analysis.playbook.map((step, index) => {
                const completed = completedSteps.includes(step.id)

                return (
                  <article
                    key={step.id}
                    className={cn(
                      'rounded-md border p-4 shadow-sm',
                      completed
                        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                        : 'border-amber-200/70 bg-card/90 dark:border-amber-950/50'
                    )}
                  >
                    <div className='flex items-start gap-3'>
                      <Checkbox
                        checked={completed}
                        onCheckedChange={() => toggleStep(step.id)}
                        aria-label={`完成 ${step.title}`}
                        className='mt-1'
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='outline'>步骤 {index + 1}</Badge>
                          <Badge variant={completed ? 'default' : 'secondary'}>
                            {completed ? '已完成' : '待执行'}
                          </Badge>
                        </div>
                        <h3 className='mt-2 text-sm font-semibold'>
                          {step.title}
                        </h3>
                        <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                          {step.description}
                        </p>
                        <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                          <span>负责人：{step.owner}</span>
                          <span>预计：{step.eta}</span>
                        </div>
                      </div>
                      <Button
                        type='button'
                        size='sm'
                        disabled={completed}
                        onClick={() => executeAction(step.id, step.command)}
                      >
                        {completed ? <Check /> : <PlayCircle />}
                        {completed ? '已执行' : step.command}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value='recovery' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-4 p-3'>
              <section>
                <div className='mb-2 flex items-center gap-2'>
                  <Megaphone className='size-4 text-sky-600' />
                  <h3 className='text-sm font-semibold'>通知记录</h3>
                </div>
                <div className='space-y-2'>
                  {analysis.communications.map((item) => (
                    <div
                      key={`${item.time}-${item.audience}`}
                      className='rounded-md border bg-card p-3'
                    >
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <Badge variant='outline'>{item.time}</Badge>
                          <strong className='text-xs'>{item.audience}</strong>
                        </div>
                        <Badge
                          variant={
                            item.status === '已通知' ? 'default' : 'secondary'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <p className='mt-2 text-xs leading-5 text-muted-foreground'>
                        {item.message}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className='rounded-md border bg-card p-4'>
                <div className='flex items-center gap-2'>
                  <BellRing className='size-4 text-emerald-600' />
                  <h3 className='text-sm font-semibold'>恢复准入条件</h3>
                </div>
                <ul className='mt-3 space-y-2'>
                  {analysis.recoveryCriteria.map((criterion) => (
                    <li
                      key={criterion}
                      className='flex gap-2 text-xs leading-5'
                    >
                      <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-emerald-600' />
                      {criterion}
                    </li>
                  ))}
                </ul>
                <Button type='button' className='mt-4 w-full' disabled>
                  所有条件满足后恢复导航
                </Button>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ConclusionItem({
  icon: Icon,
  label,
  content,
  tone,
}: {
  icon: React.ElementType
  label: string
  content: string
  tone: 'sky' | 'rose' | 'emerald'
}) {
  const styles = {
    sky: 'border-sky-200 bg-sky-50/75 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/25 dark:text-sky-100',
    rose: 'border-rose-200 bg-rose-50/75 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/25 dark:text-rose-100',
    emerald:
      'border-emerald-200 bg-emerald-50/75 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-100',
  }

  return (
    <div className={cn('rounded-md border p-3 shadow-sm', styles[tone])}>
      <div className='flex items-center gap-2 text-sm font-semibold'>
        <Icon className='size-4' />
        {label}
      </div>
      <p className='mt-2 text-xs leading-5'>{content}</p>
    </div>
  )
}
