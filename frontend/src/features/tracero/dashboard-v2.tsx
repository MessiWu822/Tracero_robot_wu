import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  LayoutGrid,
  Loader2,
  MessageSquareText,
  Search,
  Settings2,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { askOverviewQuestion } from './api'
import { useEventHistoryStore } from './event-history-store'
import {
  roleLabels,
  statusLabels,
  type RunStatus,
  type UserRole,
} from './mock-data'
import { useEventHistorySync } from './use-event-history-sync'

function StatusBadge({ status }: { status: RunStatus }) {
  const classes: Record<RunStatus, string> = {
    reasoning: 'border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200',
    done: 'border-green-200 bg-green-100 text-green-800 hover:bg-green-200',
    failed: 'border-red-200 bg-red-100 text-red-800 hover:bg-red-200',
  }
  return <Badge className={classes[status]}>{statusLabels[status]}</Badge>
}

function currentLocalDateTime() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function TraceroDashboardPage() {
  useEventHistorySync()
  const [role, setRole] = useState<UserRole>('general')
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [robot, setRobot] = useState('robot_001')
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTime)
  const [answer, setAnswer] = useState<string | null>(null)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const runs = useEventHistoryStore((state) => state.records)
  const recentRuns = runs.slice(0, 5)
  const robotOptions = Array.from(
    new Set(['robot_001', ...runs.map((run) => run.robot)])
  ).filter((item) => item && item !== 'unknown')
  const stats = runs.reduce(
    (result, run) => {
      if (run.status === 'reasoning') result.reasoning += 1
      if (run.status === 'done') result.completed += 1
      if (run.status === 'failed') result.failed += 1
      return result
    },
    { reasoning: 0, completed: 0, failed: 0 }
  )

  async function handleQuestionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submittedQuestion = question.trim()
    if (!submittedQuestion || isAsking) return

    setIsAsking(true)
    setAnswer(null)
    setQuestionError(null)
    try {
      setAnswer(
        await askOverviewQuestion({
          question: submittedQuestion,
          robot,
          occurredAt: new Date(occurredAt).toISOString(),
        })
      )
      setQuestion('')
      setIsQuestionDialogOpen(false)
    } catch (error) {
      setQuestionError(
        error instanceof Error ? error.message : '问题提交失败，请稍后重试'
      )
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div className='flex h-full flex-col'>
      <Header className='px-4'>
        <div>
          <h1 className='text-xl font-semibold'>Tracero 总览</h1>
          <p className='text-sm text-muted-foreground'>
            {roleLabels[role]}视角下的机器人行为分析与故障溯源
          </p>
        </div>
        <div className='flex-1' />
        <div className='flex items-center gap-2'>
          <ThemeSwitch />
          <span className='text-sm text-muted-foreground'>视角：</span>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as UserRole)}
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='general'>
                <LayoutGrid />
                通用
              </SelectItem>
              <SelectItem value='dev'>
                <User />
                开发
              </SelectItem>
              <SelectItem value='test'>
                <Users />
                测试
              </SelectItem>
              <SelectItem value='ops'>
                <Settings2 />
                运维
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <Main className='space-y-6 p-6'>
        <section className='overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50/70 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20'>
          <div className='flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex min-w-0 items-start gap-4'>
              <div className='flex size-12 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-white shadow-sm dark:bg-indigo-600'>
                <MessageSquareText className='size-6' />
              </div>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='text-lg font-semibold'>发起事件推理</h2>
                  <Badge className='border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'>
                    提前分析
                  </Badge>
                </div>
                <p className='mt-2 max-w-4xl text-sm leading-6 text-muted-foreground'>
                  不必等到碰撞、急停或任务失败。发现车辆摇摆、绕行、停顿等异常行为时，直接标记时间点并提问，系统会回溯该时刻前后的遥测、日志和状态变化。
                </p>
              </div>
            </div>
            <Button
              type='button'
              className='shrink-0 bg-indigo-700 text-white hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500'
              onClick={() => {
                setQuestionError(null)
                setIsQuestionDialogOpen(true)
              }}
            >
              <Search />
              提问并分析
            </Button>
          </div>
          {answer && (
            <div className='border-t border-indigo-200 bg-background/75 px-5 py-4 text-sm leading-6 dark:border-indigo-900'>
              <p className='mb-1 font-medium text-indigo-900 dark:text-indigo-200'>
                Tracero 回复
              </p>
              <p className='whitespace-pre-line text-muted-foreground'>
                {answer}
              </p>
            </div>
          )}
        </section>

        <div className='grid gap-4 md:grid-cols-3'>
          <StatCard
            title='推理中'
            value={stats.reasoning}
            description='正在分析事件证据链'
            icon={CircleDot}
            tone='blue'
          />
          <StatCard
            title='已完成'
            value={stats.completed}
            description='可在历史记录中回看'
            icon={CheckCircle2}
            tone='green'
          />
          <StatCard
            title='失败'
            value={stats.failed}
            description='需要补齐数据或重新触发'
            icon={AlertCircle}
            tone='red'
          />
        </div>

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <History className='size-5' />
              <CardTitle>最近事件</CardTitle>
            </div>
            <CardDescription>
              展示由小车 Agent 上报并由后端处理的最近事件。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>机器人</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow key={run.run_id}>
                    <TableCell className='font-mono'>
                      {run.trigger_time}
                    </TableCell>
                    <TableCell>{run.event_type}</TableCell>
                    <TableCell className='max-w-[420px] whitespace-normal'>
                      {run.summary}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='font-mono'>
                        {run.robot}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className='flex flex-wrap gap-3'>
          <Button asChild variant='outline'>
            <Link to='/tracero/current' search={{}}>
              <Bot />
              进入当前推理
            </Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/tracero/history'>
              <Clock3 />
              查看历史记录
            </Link>
          </Button>
        </div>
      </Main>

      <Dialog
        open={isQuestionDialogOpen}
        onOpenChange={(open) => !isAsking && setIsQuestionDialogOpen(open)}
      >
        <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='text-xl'>创建用户提问事件</DialogTitle>
            <DialogDescription className='leading-6'>
              告诉系统哪台车、什么时间、发生了什么看不懂的行为。
            </DialogDescription>
          </DialogHeader>

          <form className='space-y-5' onSubmit={handleQuestionSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='overview-question'>你的问题</Label>
              <Textarea
                id='overview-question'
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder='为什么车从这个时间点开始左右摇摆？'
                className='min-h-32 resize-y border-indigo-200 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-indigo-900'
                disabled={isAsking}
                autoFocus
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='overview-question-robot'>机器人</Label>
                <Select value={robot} onValueChange={setRobot}>
                  <SelectTrigger
                    id='overview-question-robot'
                    className='w-full focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {robotOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='overview-question-time'>行为发生时间</Label>
                <Input
                  id='overview-question-time'
                  type='datetime-local'
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  className='focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20'
                  disabled={isAsking}
                  required
                />
              </div>
            </div>

            {questionError && (
              <p role='alert' className='text-sm text-destructive'>
                {questionError}
              </p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type='button' variant='outline' disabled={isAsking}>
                  取消
                </Button>
              </DialogClose>
              <Button
                type='submit'
                className='bg-indigo-700 text-white hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                disabled={!question.trim() || !occurredAt || isAsking}
              >
                {isAsking ? <Loader2 className='animate-spin' /> : <Search />}
                创建事件并推理
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: number
  description: string
  icon: React.ElementType
  tone: 'blue' | 'green' | 'red'
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20',
    green:
      'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20',
    red: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20',
  }
  return (
    <Card className={styles[tone]}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='size-4' />
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-bold'>{value}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}
