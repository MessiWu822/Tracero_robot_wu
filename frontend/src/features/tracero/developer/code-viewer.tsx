import {
  Check,
  Copy,
  FileCode2,
  GitCommitHorizontal,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CodeLocation } from '../mock-data'
import { ShikiCode } from './shiki-code'

type CodeViewerProps = {
  location: CodeLocation
}

export function CodeViewer({ location }: CodeViewerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <CodeViewerPanel
        location={location}
        onExpand={() => setExpanded(true)}
      />

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          className='flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 shadow-2xl sm:max-w-[96vw]'
        >
          <DialogTitle className='sr-only'>
            放大查看 {location.filePath}
          </DialogTitle>
          <div className='min-h-0 min-w-0 flex-1'>
            <CodeViewerPanel location={location} expanded />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CodeViewerPanel({
  location,
  expanded = false,
  onExpand,
}: {
  location: CodeLocation
  expanded?: boolean
  onExpand?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const codeViewportRef = useRef<HTMLDivElement>(null)
  const fullPath = `${location.repository}/${location.filePath}:${location.lineStart}`
  const pathParts = location.filePath.split('/')
  const fileName = pathParts[pathParts.length - 1]
  const firstHighlightLine = location.highlightLines[0]

  useEffect(() => {
    const viewport = codeViewportRef.current
    if (!viewport || firstHighlightLine === undefined) return

    function scrollToHighlight(element: HTMLDivElement) {
      const highlightedLine = element.querySelector<HTMLElement>(
        `[data-line="${firstHighlightLine}"]`
      )
      if (!highlightedLine) return false

      const viewportTop = element.getBoundingClientRect().top
      const lineTop = highlightedLine.getBoundingClientRect().top
      element.scrollTop += lineTop - viewportTop
      return true
    }

    if (scrollToHighlight(viewport)) return

    const observer = new MutationObserver(() => {
      if (scrollToHighlight(viewport)) observer.disconnect()
    })

    observer.observe(viewport, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [firstHighlightLine, location.id])

  async function copyPath() {
    await navigator.clipboard.writeText(fullPath)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className='flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-md border bg-slate-950 text-slate-100 [contain:inline-size]'>
      <div className='shrink-0 border-b border-white/10 bg-slate-900 px-3 py-2.5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <FileCode2 className='size-4 text-sky-300' />
              <span className='truncate text-sm font-medium'>{fileName}</span>
              <Badge
                variant='outline'
                className='border-white/15 bg-white/5 text-[10px] text-slate-300'
              >
                {location.language}
              </Badge>
            </div>
            <p className='mt-1 break-all font-mono text-[11px] text-slate-400'>
              {fullPath}
            </p>
          </div>

          <div className='flex shrink-0 items-center gap-1'>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-8 text-slate-300 hover:bg-white/10 hover:text-white'
              onClick={copyPath}
              title='复制完整代码路径'
            >
              {copied ? (
                <Check className='size-4' />
              ) : (
                <Copy className='size-4' />
              )}
            </Button>

            {expanded ? (
              <DialogClose asChild>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='size-8 text-slate-300 hover:bg-white/10 hover:text-white'
                  title='退出放大查看'
                >
                  <Minimize2 className='size-4' />
                </Button>
              </DialogClose>
            ) : (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='size-8 text-slate-300 hover:bg-white/10 hover:text-white'
                onClick={onExpand}
                title='放大查看代码'
              >
                <Maximize2 className='size-4' />
              </Button>
            )}
          </div>
        </div>

        <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400'>
          <span>{location.functionName ?? location.module}</span>
          <span className='flex items-center gap-1'>
            <GitCommitHorizontal className='size-3' />
            {location.commit}
          </span>
          <span>
            L{location.lineStart}-L{location.lineEnd}
          </span>
        </div>
      </div>

      <div
        ref={codeViewportRef}
        className='min-h-0 min-w-0 max-w-full flex-1 overflow-auto overscroll-contain'
      >
        <ShikiCode
          code={location.content}
          language={location.language}
          lineStart={location.lineStart}
          highlightLines={location.highlightLines}
        />
        <div
          aria-hidden='true'
          className='h-[calc(100%-1.5rem)] min-h-0'
        />
      </div>

      <div className='shrink-0 border-t border-white/10 bg-slate-900/90 px-3 py-2 text-xs leading-5 text-slate-300'>
        <span className='font-medium text-amber-300'>定位说明：</span>
        {location.explanation}
      </div>
    </div>
  )
}
