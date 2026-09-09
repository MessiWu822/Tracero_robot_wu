import { Bot, History, LayoutDashboard } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Tracero',
    email: 'local@tracero.dev',
    avatar: '',
  },
  teams: [
    {
      name: 'Tracero · 智循',
      logo: Bot,
      plan: '推理链路前端',
    },
  ],
  navGroups: [
    {
      title: 'Tracero',
      items: [
        {
          title: '总览',
          url: '/tracero',
          icon: LayoutDashboard,
        },
        {
          title: '当前推理',
          url: '/tracero/current',
          icon: Bot,
        },
        {
          title: '历史记录',
          url: '/tracero/history',
          icon: History,
        },
      ],
    },
  ],
}
