import { createFileRoute } from '@tanstack/react-router'
import { HistoricalEventDetailPage } from '@/features/tracero/historical-event-detail'
import type { UserRole } from '@/features/tracero/types'

export const Route = createFileRoute('/_authenticated/tracero/event/$id')({
  validateSearch: (search: Record<string, unknown>) => ({
    role: search.role === 'dev' || search.role === 'test' || search.role === 'ops' || search.role === 'general' ? search.role as UserRole : 'general',
  }),
  component: HistoricalReasoningRoute,
})

// Route modules intentionally colocate the route definition and its component.
// eslint-disable-next-line react-refresh/only-export-components
function HistoricalReasoningRoute() {
  const { id } = Route.useParams()
  const { role } = Route.useSearch()
  return <HistoricalEventDetailPage key={`${id}-${role}`} runId={id} role={role} />
}




