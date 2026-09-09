import { useState } from 'react'
import {
  BadgeCheck,
  Bug,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  ListChecks,
  Plus,
  RotateCcw,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { mockCurrentRun } from '../mock-data'

type TestAnalysis = typeof mockCurrentRun.testAnalysis

type TestViewProps = {
  analysis: TestAnalysis
}

const priorityStyles = {
  P0: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  P1: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  P2: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
}

export function TestView({ analysis }: TestViewProps) {
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([])

  function createTask(taskId: string, title: string) {
    if (createdTaskIds.includes(taskId)) return
    setCreatedTaskIds((current) => [...current, taskId])
    toast.success(`已创建测试任务 ${taskId}`, { description: title })
  }

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.96))]'>
      <div className='shrink-0 border-b border-sky-200/70 bg-background/75 p-3 backdrop-blur dark:border-sky-950/70 dark:bg-background/55'>
        <div className='mb-3 grid gap-2 sm:grid-cols-3'>
          <MetricTile label='主归因可信度' value={`${analysis.modules[0]?.confidence ?? 0}%`} tone='rose' />
          <MetricTile label='待验证用例' value={`${analysis.testCases.length}`} tone='sky' />
          <MetricTile label='P0 任务' value={`${analysis.tasks.filter((task) => task.priority === 'P0').length}`} tone='amber' />
        </div>
        <div className='grid gap-2 xl:grid-cols-3'>
          <ConclusionItem
            icon={Bug}
            label='归因'
            content={analysis.conclusion.attribution}
            tone='rose'
          />
          <ConclusionItem
            icon={FlaskConical}
            label='验证'
            content={analysis.conclusion.verification}
            tone='sky'
          />
          <ConclusionItem
            icon={ClipboardCheck}
            label='任务'
            content={analysis.conclusion.task}
            tone='violet'
          />
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <span className='text-xs font-medium text-muted-foreground'>
            受影响功能
          </span>
          {analysis.affectedFeatures.map((feature) => (
            <Badge key={feature} variant='outline'>
              {feature}
            </Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue='attribution' className='min-h-0 min-w-0 flex-1 gap-0'>
        <div className='shrink-0 border-b border-sky-200/70 bg-white/65 px-3 py-2 backdrop-blur dark:border-sky-950/70 dark:bg-slate-950/35'>
          <TabsList className='grid w-full grid-cols-3 bg-sky-50/70 dark:bg-sky-950/30'>
            <TabsTrigger value='attribution'>
              <ShieldAlert />
              模块归因
            </TabsTrigger>
            <TabsTrigger value='verification'>
              <ListChecks />
              测试验证
            </TabsTrigger>
            <TabsTrigger value='tasks'>
              <ClipboardCheck />
              任务跟踪
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='attribution' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-3 p-3'>
              {analysis.modules.map((module) => (
                <article
                  key={module.module}
                  className={cn(
                    'rounded-md border bg-card/90 p-4 shadow-sm',
                    module.relation === 'primary'
                      ? 'border-rose-200 shadow-rose-100/70 dark:border-rose-900/70 dark:shadow-none'
                      : 'border-sky-200/80 shadow-sky-100/60 dark:border-sky-900/70 dark:shadow-none'
                  )}
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='font-mono text-sm font-semibold'>
                          {module.module}
                        </h3>
                        <Badge
                          variant={
                            module.relation === 'primary'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {module.relation === 'primary'
                            ? '主归因模块'
                            : '关联模块'}
                        </Badge>
                      </div>
                      <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                        {module.responsibility}
                      </p>
                    </div>
                    <strong className='text-lg'>{module.confidence}%</strong>
                  </div>

                  <div className='mt-3 h-2 overflow-hidden rounded-full bg-muted'>
                    <div
                      className={
                        module.relation === 'primary'
                          ? 'h-full bg-gradient-to-r from-rose-500 to-amber-400'
                          : 'h-full bg-gradient-to-r from-sky-500 to-violet-500'
                      }
                      style={{ width: `${module.confidence}%` }}
                    />
                  </div>

                  <div className='mt-3 flex flex-wrap gap-1'>
                    {module.evidence_ids.map((evidence_id) => (
                      <Badge key={evidence_id} variant='outline'>
                        {evidence_id}
                      </Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value='verification' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-3 p-3'>
              {analysis.testCases.map((testCase) => (
                <article
                  key={testCase.id}
                  className='rounded-md border bg-card p-4'
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='outline' className='font-mono'>
                          {testCase.id}
                        </Badge>
                        <Badge className={priorityStyles[testCase.priority]}>
                          {testCase.priority}
                        </Badge>
                        <Badge variant='secondary'>
                          {testCase.type === 'reproduction'
                            ? '复现'
                            : testCase.type === 'regression'
                              ? '回归'
                              : '边界'}
                        </Badge>
                      </div>
                      <h3 className='mt-2 text-sm font-semibold'>
                        {testCase.title}
                      </h3>
                    </div>
                    <StatusBadge status={testCase.status} />
                  </div>

                  <div className='mt-4 grid gap-4 xl:grid-cols-2'>
                    <TestList title='前置条件' items={testCase.preconditions} />
                    <TestList title='测试数据' items={testCase.testData} />
                  </div>

                  <div className='mt-4'>
                    <h4 className='text-xs font-semibold text-muted-foreground'>
                      复现步骤
                    </h4>
                    <ol className='mt-2 space-y-2'>
                      {testCase.steps.map((step, index) => (
                        <li
                          key={step}
                          className='flex gap-2 text-sm leading-5'
                        >
                          <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold'>
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className='mt-4 grid gap-3 xl:grid-cols-2'>
                    <ResultBlock
                      label='预期结果'
                      content={testCase.expected}
                      expected
                    />
                    <ResultBlock
                      label='实际结果'
                      content={testCase.actual}
                    />
                  </div>
                </article>
              ))}

              <section className='rounded-md border bg-card p-4'>
                <div className='flex items-center gap-2'>
                  <RotateCcw className='size-4 text-sky-600' />
                  <h3 className='text-sm font-semibold'>回归测试范围</h3>
                </div>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {analysis.regressionScope.map((scope) => (
                    <Badge key={scope} variant='secondary'>
                      {scope}
                    </Badge>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value='tasks' className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full'>
            <div className='space-y-3 p-3'>
              {analysis.tasks.map((task) => {
                const created = createdTaskIds.includes(task.id)

                return (
                  <article
                    key={task.id}
                    className='rounded-md border bg-card p-4'
                  >
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='outline' className='font-mono'>
                            {task.id}
                          </Badge>
                          <Badge className={priorityStyles[task.priority]}>
                            {task.priority}
                          </Badge>
                          <Badge variant={created ? 'default' : 'secondary'}>
                            {created ? '已创建' : task.status}
                          </Badge>
                        </div>
                        <h3 className='mt-2 text-sm font-semibold'>
                          {task.title}
                        </h3>
                      </div>
                      <Button
                        type='button'
                        size='sm'
                        disabled={created}
                        onClick={() => createTask(task.id, task.title)}
                      >
                        {created ? <BadgeCheck /> : <Plus />}
                        {created ? '任务已创建' : '创建测试任务'}
                      </Button>
                    </div>

                    <div className='mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground'>
                      <span className='flex items-center gap-1.5'>
                        <UserRound className='size-3.5' />
                        负责人：{task.owner}
                      </span>
                      <span className='flex items-center gap-1.5'>
                        <CalendarClock className='size-3.5' />
                        截止：{task.dueDate}
                      </span>
                    </div>
                  </article>
                )
              })}
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
  tone: 'rose' | 'sky' | 'violet'
}) {
  const styles = {
    rose: 'border-rose-200 bg-rose-50/75 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/25 dark:text-rose-100',
    sky: 'border-sky-200 bg-sky-50/75 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/25 dark:text-sky-100',
    violet:
      'border-violet-200 bg-violet-50/75 text-violet-950 dark:border-violet-900/70 dark:bg-violet-950/25 dark:text-violet-100',
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

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'rose' | 'sky' | 'amber'
}) {
  const styles = {
    rose: 'border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/25 dark:text-rose-100',
    sky: 'border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/25 dark:text-sky-100',
    amber:
      'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100',
  }

  return (
    <div className={cn('rounded-md border px-3 py-2 shadow-sm', styles[tone])}>
      <p className='text-[11px] font-medium opacity-75'>{label}</p>
      <strong className='mt-1 block text-xl leading-none'>{value}</strong>
    </div>
  )
}

function TestList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className='text-xs font-semibold text-muted-foreground'>{title}</h4>
      <ul className='mt-2 space-y-1.5'>
        {items.map((item) => (
          <li key={item} className='flex gap-2 text-xs leading-5'>
            <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-emerald-600' />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultBlock({
  label,
  content,
  expected = false,
}: {
  label: string
  content: string
  expected?: boolean
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        expected
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/70 dark:bg-emerald-950/20'
          : 'border-rose-200 bg-rose-50/60 dark:border-rose-900/70 dark:bg-rose-950/20'
      }`}
    >
      <h4 className='text-xs font-semibold'>{label}</h4>
      <p className='mt-1.5 text-xs leading-5'>{content}</p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'failed' | 'pending' | 'passed'
}) {
  if (status === 'failed') return <Badge variant='destructive'>未通过</Badge>
  if (status === 'passed') return <Badge>已通过</Badge>
  return <Badge variant='secondary'>待执行</Badge>
}
