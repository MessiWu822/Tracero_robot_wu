import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'

type PanelLayout = {
  left: number
  middle: number
  right: number
}

const STORAGE_KEY = 'tracero:panel-layout'
const DEFAULT_LAYOUT: PanelLayout = { left: 22, middle: 50, right: 28 }
const percent = (value: number) => `${value}%`

export function ResizablePanels({
  left,
  middle,
  right,
}: {
  left: ReactNode
  middle: ReactNode
  right: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [layout, setLayout] = useState<PanelLayout>(DEFAULT_LAYOUT)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PanelLayout>
        setLayout({ ...DEFAULT_LAYOUT, ...parsed })
      }
    } catch {
      // Ignore errors
    }
    setMounted(true)
  }, [])

  const handleLayoutChange = useCallback((sizes: Layout) => {
    if (
      sizes.timeline !== undefined &&
      sizes.evidence !== undefined &&
      sizes.chat !== undefined
    ) {
      const newLayout: PanelLayout = {
        left: sizes.timeline,
        middle: sizes.evidence,
        right: sizes.chat,
      }
      setLayout(newLayout)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
      } catch {
        // Ignore errors
      }
    }
  }, [])

  if (!mounted) {
    return (
      <div className='grid h-full min-h-0 grid-cols-[280px_minmax(420px,1fr)_360px] gap-0 2xl:grid-cols-[300px_minmax(520px,1fr)_400px]'>
        {left}
        {middle}
        {right}
      </div>
    )
  }

  return (
    <Group
      orientation='horizontal'
      className='h-full min-h-0'
      onLayoutChanged={handleLayoutChange}
      resizeTargetMinimumSize={{ coarse: 20, fine: 12 }}
    >
      <Panel
        id='timeline'
        defaultSize={percent(layout.left)}
        minSize='15%'
        maxSize='35%'
        className='h-full min-w-0 overflow-hidden py-0'
      >
        {left}
      </Panel>

      <ResizeHandle />

      <Panel
        id='evidence'
        defaultSize={percent(layout.middle)}
        minSize='35%'
        maxSize='70%'
        className='h-full min-w-0 overflow-hidden py-0'
      >
        {middle}
      </Panel>

      <ResizeHandle />

      <Panel
        id='chat'
        defaultSize={percent(layout.right)}
        minSize='20%'
        maxSize='40%'
        className='h-full min-w-0 overflow-hidden py-0'
      >
        {right}
      </Panel>
    </Group>
  )
}

function ResizeHandle() {
  return (
    <Separator className='group relative flex w-4 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary/30'>
      <div className='h-full w-px bg-border/90 shadow-[0_0_0_1px_hsl(var(--background))] transition-all group-hover:w-1 group-hover:bg-primary/35 dark:bg-border/70' />
    </Separator>
  )
}
