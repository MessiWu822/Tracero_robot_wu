import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

const mockEvents = [
  {
    id: 1234,
    title: '机器人碰撞障碍物',
    timestamp: '2024-05-11 14:32:07',
    status: 'error' as const,
    severity: 'high',
    robot: 'robot_001',
  },
  {
    id: 1233,
    title: '导航超时',
    timestamp: '2024-05-11 12:15:32',
    status: 'warning' as const,
    severity: 'medium',
    robot: 'robot_001',
  },
  {
    id: 1232,
    title: '激光雷达数据异常',
    timestamp: '2024-05-10 18:45:12',
    status: 'error' as const,
    severity: 'high',
    robot: 'robot_002',
  },
  {
    id: 1231,
    title: '路径规划成功',
    timestamp: '2024-05-10 16:30:45',
    status: 'success' as const,
    severity: 'low',
    robot: 'robot_001',
  },
  {
    id: 1230,
    title: '里程计数据丢失',
    timestamp: '2024-05-09 21:10:00',
    status: 'warning' as const,
    severity: 'medium',
    robot: 'robot_002',
  },
]

export function EventListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'error':
        return <AlertCircle className='h-5 w-5 text-red-500' />
      case 'warning':
        return <AlertCircle className='h-5 w-5 text-orange-500' />
      case 'success':
        return <CheckCircle2 className='h-5 w-5 text-green-500' />
      default:
        return <Calendar className='h-5 w-5 text-muted-foreground' />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant='destructive'>高</Badge>
      case 'medium':
        return (
          <Badge variant='default' className='bg-orange-500'>
            中
          </Badge>
        )
      case 'low':
        return <Badge variant='secondary'>低</Badge>
      default:
        return <Badge variant='outline'>未知</Badge>
    }
  }

  const filteredEvents = mockEvents.filter(
    (event) =>
      (statusFilter === 'all' || event.status === statusFilter) &&
      (searchQuery === '' ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.robot.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className='flex h-full flex-col'>
      <Header className='px-6'>
        <div>
          <h1 className='text-xl font-semibold'>Tracero</h1>
          <p className='text-sm text-muted-foreground'>机器人异常溯源系统</p>
        </div>

        <div className='flex items-center gap-4'>
          <div className='relative flex-1 md:w-96'>
            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='搜索事件...'
              className='pl-9'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-32'>
              <div className='flex items-center gap-2'>
                <Filter className='h-4 w-4' />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部</SelectItem>
              <SelectItem value='error'>错误</SelectItem>
              <SelectItem value='warning'>警告</SelectItem>
              <SelectItem value='success'>成功</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <Main className='p-6'>
        <div className='grid gap-4'>
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              className='cursor-pointer transition-shadow hover:shadow-md'
              onClick={() =>
                navigate({
                  to: '/tracero/event/$id',
                  params: { id: event.id.toString() },
                  search: { role: 'general' },
                })
              }
            >
              <CardHeader className='pb-3'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-3'>
                    <div className='mt-1'>{getStatusIcon(event.status)}</div>
                    <div>
                      <CardTitle className='text-base'>{event.title}</CardTitle>
                      <CardDescription>
                        事件 #{event.id} · {event.timestamp}
                      </CardDescription>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {getSeverityBadge(event.severity)}
                    <Badge variant='outline' className='font-mono'>
                      {event.robot}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
          {filteredEvents.length === 0 && (
            <Card>
              <CardContent className='py-8 text-center text-muted-foreground'>
                没有找到匹配的事件
              </CardContent>
            </Card>
          )}
        </div>
      </Main>
    </div>
  )
}

