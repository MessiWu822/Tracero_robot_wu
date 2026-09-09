import { createContext } from 'react'
import type {
  AgentPushStatus,
  DeveloperTab,
  TraceroRun,
  UserRole,
} from '@/features/tracero/types'

export interface TraceroContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  selectedLocationId: string | undefined
  setSelectedLocationId: (locationId: string | undefined) => void
  developerTab: DeveloperTab
  setDeveloperTab: (tab: DeveloperTab) => void
  currentRun: TraceroRun | null
  pushStatus: AgentPushStatus
  error: string | null
  isLoadingCurrentRun: boolean
  loadCurrentRun: () => Promise<void>
}

export const TraceroContext = createContext<TraceroContextType | null>(null)
