import { createFileRoute } from '@tanstack/react-router'
import { TraceroDashboardPage } from '@/features/tracero/dashboard-v2'

export const Route = createFileRoute('/_authenticated/tracero/')({
  component: TraceroDashboardPage,
})
