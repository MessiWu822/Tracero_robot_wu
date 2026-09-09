import {
  Box,
  ChevronDown,
  CircleDot,
  Code2,
  GitBranch,
  Radio,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CallChainNode } from '../mock-data'

const nodeIcons = {
  topic: Radio,
  module: Box,
  function: Code2,
  decision: GitBranch,
}

const statusStyles = {
  normal: 'border-sky-200 bg-sky-50 text-sky-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
}

type CallChainProps = {
  nodes: CallChainNode[]
  selectedLocationId: string
  onSelectLocation: (locationId: string) => void
}

export function CallChain({
  nodes,
  selectedLocationId,
  onSelectLocation,
}: CallChainProps) {
  return (
    <Collapsible
      defaultOpen
      className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
    >
      <CollapsibleTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          className='h-10 shrink-0 justify-between rounded-none border-b px-3'
        >
          <span className='flex items-center gap-2 text-sm font-medium'>
            <GitBranch className='size-4' />
            问题调用链
          </span>
          <ChevronDown className='size-4' />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='min-h-0 min-w-0 flex-1 overflow-hidden'>
        <ScrollArea className='h-full min-w-0'>
          <div className='space-y-1 px-3 py-2'>
            {nodes.map((node, index) => {
              const Icon = nodeIcons[node.type]
              const selected =
                !!node.codeLocationId &&
                node.codeLocationId === selectedLocationId

              return (
                <div key={node.id} className='relative'>
                  {index < nodes.length - 1 && (
                    <span className='absolute top-9 bottom-[-8px] left-[21px] w-px bg-border' />
                  )}
                  <button
                    type='button'
                    disabled={!node.codeLocationId}
                    onClick={() =>
                      node.codeLocationId &&
                      onSelectLocation(node.codeLocationId)
                    }
                    className={cn(
                      'relative flex w-full items-start gap-2 rounded-md border border-transparent p-2 pr-3 text-left transition-colors',
                      node.codeLocationId && 'hover:bg-muted',
                      selected && 'border-primary/30 bg-primary/8'
                    )}
                  >
                    <span
                      className={cn(
                        'z-10 flex size-7 shrink-0 items-center justify-center rounded-full border',
                        statusStyles[node.status]
                      )}
                    >
                      <Icon className='size-3.5' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block break-all whitespace-normal font-mono text-xs leading-5 font-medium'>
                        {node.label}
                      </span>
                      <span className='mt-1 block break-words text-[11px] leading-4 text-muted-foreground'>
                        {node.detail}
                      </span>
                      <span className='mt-1.5 flex flex-wrap gap-1'>
                        {node.evidence_ids.map((evidence_id) => (
                          <Badge
                            key={evidence_id}
                            variant='outline'
                            className='h-5 px-1.5 text-[9px]'
                          >
                            {evidence_id}
                          </Badge>
                        ))}
                        {node.elapsedMs !== undefined && (
                          <Badge
                            variant='secondary'
                            className='h-5 px-1.5 text-[9px]'
                          >
                            +{node.elapsedMs}ms
                          </Badge>
                        )}
                      </span>
                    </span>
                    {selected && (
                      <CircleDot className='mt-1 size-3.5 shrink-0 text-primary' />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}
