import { createFileRoute } from '@tanstack/react-router'
import { TraceroHistoryPage } from '@/features/tracero/history'

export const Route = createFileRoute('/_authenticated/tracero/history')({
  component: TraceroHistoryPage,
})
