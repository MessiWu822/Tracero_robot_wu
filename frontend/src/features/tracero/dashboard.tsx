import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  History,
  LayoutGrid,
  Settings2,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  roleLabels,
  mockRuns,
  mockStats,
  statusLabels,
  type RunStatus,
  type UserRole,
} from './mock-data'

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

export function TraceroDashboardPage() {
  const [role, setRole] = useState<UserRole>('general')
  const recentRuns = mockRuns.slice(0, 5)

  return (
    <div className='flex h-full flex-col'>
      <Header className='px-4'>
        <div>
          <h1 className='text-xl font-semibold'>Tracero 总览</h1>
          <p className='text-sm text-muted-foreground'>
            {roleLabels[role]}视角下的机器人异常溯源系统状态
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

      <Main className='space-y-6 p-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <Card className='border-blue-200 bg-blue-50 shadow-sm shadow-blue-100/70 dark:border-blue-900 dark:bg-blue-950/20 dark:shadow-none'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                推理中
              </CardTitle>
              <CircleDot className='size-4 text-black' />
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold text-black dark:text-blue-300'>
                {mockStats.reasoning}
              </div>
              <p className='text-xs text-black dark:text-blue-100'>
                正在分析异常证据链
              </p>
            </CardContent>
          </Card>

          <Card className='border-green-200 bg-green-50 shadow-sm shadow-green-100/70 dark:border-green-900 dark:bg-green-950/20 dark:shadow-none'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-green-900 dark:text-green-100'>
                已完成
              </CardTitle>
              <CheckCircle2 className='size-4 text-black' />
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold text-black dark:text-green-300'>
                {mockStats.completed}
              </div>
              <p className='text-xs text-black dark:text-green-200/80'>
                可在历史记录中回看
              </p>
            </CardContent>
          </Card>

          <Card className='border-red-200 bg-red-50 shadow-sm shadow-red-100/70 dark:border-red-900 dark:bg-red-950/20 dark:shadow-none'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-red-900 dark:text-red-100'>
                失败
              </CardTitle>
              <AlertCircle className='size-4 text-black' />
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold text-black dark:text-red-300'>
                {mockStats.failed}
              </div>
              <p className='text-xs text-black dark:text-red-200/80'>
                需要补齐数据或重新触发
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <History className='size-5' />
              <CardTitle>最近事件</CardTitle>
            </div>
            <CardDescription>
              用于演示总览页到当前推理、历史记录的完整链路
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

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Bot className='size-5' />
              <CardTitle>演示路径</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-3'>
            <Button asChild variant='outline'>
              <Link
                to='/tracero/current'
                search={{ role: 'general', tab: 'code' }}
              >
                进入当前推理
              </Link>
            </Button>
            <Button asChild variant='outline'>
              <Link to='/tracero/history'>查看历史记录</Link>
            </Button>
          </CardContent>
        </Card>
      </Main>
    </div>
  )
}
