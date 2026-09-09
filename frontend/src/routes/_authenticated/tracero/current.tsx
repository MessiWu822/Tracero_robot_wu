import { createFileRoute } from '@tanstack/react-router'
import { TraceroProvider } from '@/context/tracero-provider'
import { EventDetailPage } from '@/features/tracero/event-detail'
import type { DeveloperTab, UserRole } from '@/features/tracero/types'

type CurrentSearch = {
  preview?: 'rounds'
  role?: UserRole
  tab?: DeveloperTab
}

export const Route = createFileRoute('/_authenticated/tracero/current')({
  validateSearch: (search: Record<string, unknown>): CurrentSearch => ({
    preview: search.preview === 'rounds' ? 'rounds' : undefined,
    role:
      search.role === 'general' ||
      search.role === 'dev' ||
      search.role === 'test' ||
      search.role === 'ops'
        ? search.role
        : undefined,
    tab:
      search.tab === 'code' ||
      search.tab === 'parameters' ||
      search.tab === 'logs' ||
      search.tab === 'runtime'
        ? search.tab
        : undefined,
  }),
  component: CurrentReasoningRoute,
})

// Route modules intentionally colocate the route definition and its component.
// eslint-disable-next-line react-refresh/only-export-components
function CurrentReasoningRoute() {
  const search = Route.useSearch()

  return (
    <TraceroProvider initialRole={search.role} initialDeveloperTab={search.tab}>
      <EventDetailPage preview={search.preview === 'rounds'} />
    </TraceroProvider>
  )
}
