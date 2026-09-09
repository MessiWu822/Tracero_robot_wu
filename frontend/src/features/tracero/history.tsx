import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  Search,
  Settings2,
  User,
  Users,
  CalendarDays,
  Bot,
  Activity,
  Hash,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  findDuplicateEventIds,
  type EventHistoryRecord,
  useEventHistoryStore,
} from './event-history-store'
import {
  roleLabels,
  statusLabels,
  type RunStatus,
  type UserRole,
} from './mock-data'
import { useEventHistorySync } from './use-event-history-sync'

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'reasoning', label: '推理中' },
  { value: 'done', label: '已完成' },
  { value: 'failed', label: '失败' },
]

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === 'reasoning') {
    return (
      <Badge className='border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200'>
        {statusLabels[status]}
      </Badge>
    )
  }

  if (status === 'failed') {
    return (
      <Badge className='border-red-200 bg-red-100 text-red-800 hover:bg-red-200'>
        {statusLabels[status]}
      </Badge>
    )
  }

  return (
    <Badge className='border-green-200 bg-green-100 text-green-800 hover:bg-green-200'>
      {statusLabels[status]}
    </Badge>
  )
}

function getRunDate(run: EventHistoryRecord) {
  if (run.event_time_iso) {
    const eventDate = new Date(run.event_time_iso)
    if (!Number.isNaN(eventDate.getTime())) return eventDate
  }

  const match = run.run_id.match(/^run_(\d{4})(\d{2})(\d{2})/)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatDateRange(dateRange: DateRange | undefined) {
  if (!dateRange?.from) return '选择日期范围'
  if (!dateRange.to) return format(dateRange.from, 'yyyy-MM-dd')
  return `${format(dateRange.from, 'yyyy-MM-dd')} 至 ${format(dateRange.to, 'yyyy-MM-dd')}`
}

export function TraceroHistoryPage() {
  useEventHistorySync()
  const navigate = useNavigate()
  const runs = useEventHistoryStore((state) => state.records)
  const [role, setRole] = useState<UserRole>('general')
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>()
  const [robotFilter, setRobotFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [runIdFilter, setRunIdFilter] = useState('')
  const duplicateEventIds = useMemo(() => findDuplicateEventIds(runs), [runs])
  const robotOptions = useMemo(
    () => [
      { value: 'all', label: '全部机器人' },
      ...[...new Set(runs.map((run) => run.robot))].map((robot) => ({
        value: robot,
        label: robot,
      })),
    ],
    [runs]
  )

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchKeyword =
        !keyword ||
        run.summary.toLowerCase().includes(keyword.toLowerCase()) ||
        run.event_type.toLowerCase().includes(keyword.toLowerCase())

      const matchRunId =
        !runIdFilter ||
        run.run_id.toLowerCase().includes(runIdFilter.toLowerCase())

      const runDate = getRunDate(run)
      const matchTime =
        !dateRange?.from ||
        (Boolean(runDate) &&
          runDate! >= dateRange.from &&
          (!dateRange.to || runDate! <= dateRange.to))
      const matchRobot = robotFilter === 'all' || run.robot === robotFilter
      const matchStatus = statusFilter === 'all' || run.status === statusFilter

      return (
        matchKeyword && matchRunId && matchTime && matchRobot && matchStatus
      )
    })
  }, [runs, keyword, dateRange, robotFilter, statusFilter, runIdFilter])

  const handleReset = () => {
    setKeyword('')
    setDateRange(undefined)
    setRobotFilter('all')
    setStatusFilter('all')
    setRunIdFilter('')
  }

  const hasFilters =
    keyword ||
    dateRange?.from ||
    robotFilter !== 'all' ||
    statusFilter !== 'all' ||
    runIdFilter

  const openRun = (runId: string) =>
    navigate({
      to: '/tracero/event/$id',
      params: { id: runId },
      search: { role },
    })

  return (
    <div className='flex h-full flex-col'>
      <Header className='px-4'>
        <div>
          <h1 className='text-xl font-semibold'>历史记录</h1>
          <p className='text-sm text-muted-foreground'>
            {roleLabels[role]}视角下的异常溯源事件列表
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
                <div className='flex items-center gap-2'>
                  <LayoutGrid className='size-4' />
                  <span>通用</span>
                </div>
              </SelectItem>
              <SelectItem value='dev'>
                <div className='flex items-center gap-2'>
                  <User className='size-4' />
                  <span>开发</span>
                </div>
              </SelectItem>
              <SelectItem value='test'>
                <div className='flex items-center gap-2'>
                  <Users className='size-4' />
                  <span>测试</span>
                </div>
              </SelectItem>
              <SelectItem value='ops'>
                <div className='flex items-center gap-2'>
                  <Settings2 className='size-4' />
                  <span>运维</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <Main className='p-6'>
        <Card>
          <CardHeader>
            <CardTitle>历史事件</CardTitle>
            <CardDescription>
              小车 Agent 上报并由后端处理的事件会实时汇总到这里
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='mb-4 flex flex-wrap items-center gap-3'>
              <div className='relative'>
                <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='搜索关键字...'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className='w-64 pl-9'
                />
              </div>
              <div className='relative'>
                <Hash className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='搜索Run ID...'
                  value={runIdFilter}
                  onChange={(e) => setRunIdFilter(e.target.value)}
                  className='w-52 pl-9'
                />
              </div>
              <div className='flex items-center gap-2'>
                <CalendarDays className='h-4 w-4 text-muted-foreground' />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='w-[245px] justify-start text-left font-normal'
                    >
                      <CalendarDays className='mr-2 h-4 w-4' />
                      <span
                        className={
                          !dateRange?.from ? 'text-muted-foreground' : ''
                        }
                      >
                        {formatDateRange(dateRange)}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='range'
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      defaultMonth={dateRange?.from}
                      disabled={{ after: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className='flex items-center gap-2'>
                <Bot className='h-4 w-4 text-muted-foreground' />
                <Select
                  value={robotFilter}
                  onValueChange={(value) => setRobotFilter(value)}
                >
                  <SelectTrigger className='w-36'>
                    <SelectValue placeholder='选择机器人' />
                  </SelectTrigger>
                  <SelectContent>
                    {robotOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center gap-2'>
                <Activity className='h-4 w-4 text-muted-foreground' />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <SelectTrigger className='w-32'>
                    <SelectValue placeholder='选择状态' />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasFilters && (
                <Button
                  variant='ghost'
                  onClick={handleReset}
                  className='ml-auto'
                >
                  重置筛选
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>机器人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>
                    <span className='sr-only'>打开推理</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => (
                  <TableRow
                    key={run.run_id}
                    role='link'
                    tabIndex={0}
                    aria-label={`打开 ${run.run_id} 的历史推理`}
                    className='cursor-pointer transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset'
                    onClick={() => openRun(run.run_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void openRun(run.run_id)
                      }
                    }}
                  >
                    <TableCell className='font-mono text-xs'>
                      {run.run_id}
                    </TableCell>
                    <TableCell className='max-w-[220px] font-mono text-xs'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate'>{run.event_id ?? '-'}</span>
                        {run.event_id && duplicateEventIds.has(run.event_id) ? (
                          <Badge
                            variant='outline'
                            className='shrink-0 border-amber-300 bg-amber-50 text-amber-800'
                            title='后端为同一 Event ID 返回了多个 Run'
                          >
                            <AlertTriangle className='mr-1 size-3' />
                            重复 Run
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='font-mono'>
                      {run.trigger_time}
                    </TableCell>
                    <TableCell>{run.event_type}</TableCell>
                    <TableCell className='max-w-[440px] whitespace-normal'>
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
                    <TableCell className='w-10 text-right'>
                      <ChevronRight className='ml-auto size-4 text-muted-foreground' />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>
    </div>
  )
}

