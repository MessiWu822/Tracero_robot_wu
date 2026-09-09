import { Activity, Code2, FileText, GitBranch, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { mockCurrentRun } from '../mock-data'
import { CallChain } from './call-chain'
import { CodeViewer } from './code-viewer'

type DeveloperAnalysis = typeof mockCurrentRun.developerAnalysis
type Conclusion = typeof mockCurrentRun.conclusion
export type DeveloperTab = 'code' | 'parameters' | 'logs' | 'runtime'

type DeveloperViewProps = {
  analysis: DeveloperAnalysis
  conclusion: Conclusion
  selectedLocationId: string
  activeTab: DeveloperTab
  onSelectLocation: (locationId: string) => void
  onTabChange: (tab: DeveloperTab) => void
}

export function DeveloperView({
  analysis,
  conclusion,
  selectedLocationId,
  activeTab,
  onSelectLocation,
  onTabChange,
}: DeveloperViewProps) {
  const selectedLocation =
    analysis.codeLocations.find(
      (location) => location.id === selectedLocationId
    ) ?? analysis.codeLocations[0]
  const activeChainNode = analysis.callChain.find(
    (node) => node.codeLocationId === selectedLocation.id
  )

  return (
    <div className='flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-[linear-gradient(rgba(79,70,229,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.04)_1px,transparent_1px),radial-gradient(circle_at_top_left,rgba(79,70,229,0.12),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.98))] bg-[size:28px_28px,28px_28px,auto,auto] dark:bg-[linear-gradient(rgba(129,140,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(129,140,248,0.07)_1px,transparent_1px),radial-gradient(circle_at_top_left,rgba(79,70,229,0.24),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.97))]'>
      <div className='shrink-0 border-b border-indigo-200/70 bg-background/75 px-3 py-3 backdrop-blur dark:border-indigo-950/70 dark:bg-background/55'>
        <div className='relative mb-3 overflow-hidden rounded-md border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 shadow-sm shadow-indigo-100/70 dark:border-indigo-900/70 dark:bg-indigo-950/25 dark:shadow-none'>
          <div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent' />
          <div className='pointer-events-none absolute right-0 top-0 h-full w-28 bg-[linear-gradient(110deg,transparent,rgba(99,102,241,0.16),transparent)]' />
          <div className='relative flex flex-wrap items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <div className='flex size-8 shrink-0 items-center justify-center rounded-md border border-indigo-300/60 bg-indigo-600 text-white shadow-sm shadow-indigo-300/60 dark:border-indigo-400/30 dark:shadow-none'>
              <GitBranch className='size-4' />
            </div>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='text-sm font-semibold text-indigo-950 dark:text-indigo-100'>
                  开发定位工作台
                </h2>
                <span className='rounded border border-indigo-300/70 bg-white/45 px-1.5 py-0.5 font-mono text-[9px] text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'>
                  TRACE ONLINE
                </span>
              </div>
              <p className='truncate font-mono text-[11px] text-indigo-700/80 dark:text-indigo-200/80'>
                {selectedLocation.filePath}:{selectedLocation.lineStart}
              </p>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {activeChainNode?.elapsedMs !== undefined && (
              <Badge variant='outline' className='border-indigo-300 bg-white/45 font-mono text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'>
                +{activeChainNode.elapsedMs}ms
              </Badge>
            )}
            <Badge className='bg-indigo-600 text-white hover:bg-indigo-600'>
              {selectedLocation.evidence_id} · {selectedLocation.module}
            </Badge>
          </div>
          </div>
        </div>
        <div className='mb-3 grid gap-2 xl:grid-cols-3'>
          <ConclusionItem
            label='事实'
            content={conclusion.fact}
            evidence_id='E-03'
            tone='blue'
            onClick={() => onSelectLocation('LOC-E03')}
          />
          <ConclusionItem
            label='推理'
            content={conclusion.reasoning}
            evidence_id='E-02'
            tone='violet'
            onClick={() => onSelectLocation('LOC-E02')}
          />
          <ConclusionItem
            label='建议'
            content={conclusion.suggestion}
            evidence_id='E-04'
            tone='cyan'
            onClick={() => onSelectLocation('LOC-E04')}
          />
        </div>
        <div className='flex flex-wrap items-start justify-between gap-2 px-1'>
          <div className='min-w-0 flex-1'>
            <p className='mt-1 text-xs leading-5 text-muted-foreground'>
              {analysis.technicalSummary}
            </p>
          </div>
        </div>
      </div>

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row'>
        <div className='relative z-10 flex min-h-52 min-w-0 shrink-0 flex-col overflow-hidden border-b border-indigo-200/70 bg-white/80 backdrop-blur lg:min-h-0 lg:w-[320px] lg:border-r lg:border-b-0 dark:border-indigo-950/70 dark:bg-slate-950/45'>
          <CallChain
            nodes={analysis.callChain}
            selectedLocationId={selectedLocation.id}
            onSelectLocation={onSelectLocation}
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as DeveloperTab)}
          className='relative z-0 min-h-0 min-w-0 flex-1 gap-0 overflow-hidden [contain:inline-size] lg:w-0'
        >
          <div className='shrink-0 border-b border-indigo-200/70 bg-white/65 px-3 py-2 backdrop-blur dark:border-indigo-950/70 dark:bg-slate-950/35'>
            <TabsList className='grid w-full grid-cols-4 bg-indigo-50/70 dark:bg-indigo-950/30'>
              <TabsTrigger value='code'>
                <Code2 />
                代码
              </TabsTrigger>
              <TabsTrigger value='parameters'>
                <Settings2 />
                参数
              </TabsTrigger>
              <TabsTrigger value='logs'>
                <FileText />
                日志
              </TabsTrigger>
              <TabsTrigger value='runtime'>
                <Activity />
                运行数据
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value='code'
            className='min-h-0 min-w-0 overflow-hidden p-3'
          >
            <CodeViewer location={selectedLocation} />
          </TabsContent>

          <TabsContent value='parameters' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='space-y-2 p-3'>
                {analysis.parameters.map((parameter) => (
                  <Button
                    key={parameter.name}
                    type='button'
                    variant='outline'
                    className='h-auto w-full justify-start border-indigo-200/80 bg-white/80 p-3 text-left shadow-sm hover:bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-slate-950/35 dark:hover:bg-indigo-950/25'
                    onClick={() => {
                      onSelectLocation(parameter.codeLocationId)
                      onTabChange('code')
                    }}
                  >
                    <span className='min-w-0 flex-1'>
                      <span className='block font-mono text-xs font-semibold'>
                        {parameter.name}
                      </span>
                      <span className='mt-1 block text-xs text-muted-foreground'>
                        当前 {parameter.value} → 建议{' '}
                        {parameter.recommendedValue}
                      </span>
                      <span className='mt-1 block truncate font-mono text-[10px] text-muted-foreground'>
                        {parameter.filePath}:{parameter.line}
                      </span>
                    </span>
                    <Badge className='bg-indigo-100 font-mono text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200'>
                      {parameter.evidence_id}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='logs' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='space-y-2 p-3'>
                {analysis.logs.map((log) => (
                  <button
                    key={`${log.time}-${log.message}`}
                    type='button'
                    className='w-full rounded-md border border-indigo-200/80 bg-card/90 p-3 text-left shadow-sm hover:bg-indigo-50/70 dark:border-indigo-900/60 dark:hover:bg-indigo-950/25'
                    onClick={() => {
                      if (log.codeLocationId) {
                        onSelectLocation(log.codeLocationId)
                        onTabChange('code')
                      }
                    }}
                  >
                    <span className='flex flex-wrap items-center gap-2'>
                      <Badge
                        variant={log.level === 'ERROR' ? 'destructive' : 'outline'}
                      >
                        {log.level}
                      </Badge>
                      <span className='font-mono text-[10px] text-muted-foreground'>
                        {log.time} · {log.source}
                      </span>
                    </span>
                    <span className='mt-2 block font-mono text-xs'>
                      {log.message}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='runtime' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='grid gap-3 p-3 sm:grid-cols-2'>
                {analysis.runtimeMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className='rounded-md border border-indigo-200/80 bg-card/90 p-3 shadow-sm dark:border-indigo-900/60'
                  >
                    <p className='text-xs text-muted-foreground'>
                      {metric.label}
                    </p>
                    <div className='mt-2 flex items-end justify-between gap-2'>
                      <strong className='text-xl'>{metric.value}</strong>
                      <Badge
                        variant={
                          metric.status === 'critical'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {metric.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ConclusionItem({
  label,
  content,
  evidence_id,
  tone,
  onClick,
}: {
  label: string
  content: string
  evidence_id: string
  tone: 'blue' | 'violet' | 'cyan'
  onClick: () => void
}) {
  const styles = {
    blue: 'border-blue-200/90 bg-blue-50/80 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/25 dark:text-blue-100',
    violet:
      'border-violet-200/90 bg-violet-50/80 text-violet-950 dark:border-violet-900/70 dark:bg-violet-950/25 dark:text-violet-100',
    cyan: 'border-cyan-200/90 bg-cyan-50/80 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/25 dark:text-cyan-100',
  }

  return (
    <div className={cn('rounded-md border p-2.5 shadow-sm', styles[tone])}>
      <div className='flex items-center justify-between gap-2'>
        <strong className='text-xs'>{label}</strong>
        <button
          type='button'
          onClick={onClick}
          className='rounded border border-current/20 bg-white/45 px-1.5 py-0.5 font-mono text-[9px] hover:bg-white/80'
          title={`定位 ${evidence_id}`}
        >
          {evidence_id}
        </button>
      </div>
      <p className='mt-1.5 line-clamp-3 text-[11px] leading-5'>{content}</p>
    </div>
  )
}
