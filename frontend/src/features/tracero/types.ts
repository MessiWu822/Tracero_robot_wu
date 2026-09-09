import type { mockCurrentRun } from './mock-data'

type MockRun = typeof mockCurrentRun

export type Perspective = 'general' | 'dev' | 'test' | 'ops'

export type RunSectionSource = 'backend' | 'demo' | 'legacy' | 'unavailable'

export type RunDataProvenance = {
  event: RunSectionSource
  conclusion: RunSectionSource
  evidence: RunSectionSource
  rich_analysis: RunSectionSource
}

export type TraceroEvidence = {
  evidence_id: string
  type: 'log' | 'code' | 'metric' | 'config'
  title: string
  source: string
  excerpt: string
  impact: string
  [key: string]: unknown
}

export type ReasoningRoundSnapshot = {
  round: number
  title: string
  reasoning: string
  tool_calls: string[]
  evidence_ids: string[]
  evidence?: TraceroEvidence[]
}

export type PerspectiveView = {
  perspective: Perspective
  focus: string
  conclusion: ReasoningConclusion
  evidence: TraceroEvidence[]
  evidence_ids: string[]
  reasoning_rounds: ReasoningRoundSnapshot[]
  evidence_by_type: Record<string, TraceroEvidence[]>
}

export type TraceroRun = Omit<
  MockRun,
  | 'timeline'
  | 'evidence'
  | 'developerAnalysis'
  | 'testAnalysis'
  | 'opsAnalysis'
  | 'chatHistory'
> & {
  event_id?: string | null
  perspective?: Perspective
  perspective_view?: PerspectiveView
  available_perspectives?: Perspective[]
  reasoning_rounds?: ReasoningRoundSnapshot[]
  timeline?: MockRun['timeline']
  evidence?: TraceroEvidence[]
  developerAnalysis?: MockRun['developerAnalysis']
  testAnalysis?: MockRun['testAnalysis']
  opsAnalysis?: MockRun['opsAnalysis']
  chatHistory?: MockRun['chatHistory']
  data_source?: 'demo' | 'robot' | 'direct' | 'legacy'
  timeline_source?: 'backend' | 'derived' | 'demo'
  data_provenance?: RunDataProvenance
}

export type UserRole = 'general' | 'dev' | 'test' | 'ops'
export type DeveloperTab = 'code' | 'parameters' | 'logs' | 'runtime'

export type AgentPushStatus =
  | 'idle'
  | 'receiving'
  | 'reasoning'
  | 'done'
  | 'failed'

export type ReasoningConclusion = {
  fact: string
  reasoning: string
  suggestion: string
}

