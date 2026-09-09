import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getRunById } from './api'
import { EventDetailContent } from './event-detail'
import type { TraceroRun, UserRole } from './types'

export function HistoricalEventDetailPage({ runId, role = 'general' }: { runId: string; role?: UserRole }) {
  const navigate = useNavigate()
  const [reloadKey, setReloadKey] = useState(0)
  const [run, setRun] = useState<TraceroRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getRunById(runId, role)
      .then((result) => {
        if (!cancelled) setRun(result)
      })
      .catch((error) => {
        if (!cancelled) {
          setError(
            error instanceof Error ? error.message : '历史推理记录加载失败'
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [runId, role, reloadKey])

  function reload() {
    setRun(null)
    setError(null)
    setReloadKey((value) => value + 1)
  }

  if (run) {
    return (
      <EventDetailContent
        run={run}
        status={run.status}
        role={role}
        backTo='/tracero/history'
        title='历史推理'
      />
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <Header fixed>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => navigate({ to: '/tracero/history' })}
          aria-label='返回历史记录'
        >
          <ChevronLeft />
        </Button>
        <div className='min-w-0'>
          <h1 className='truncate text-lg font-semibold sm:text-xl'>
            历史推理
          </h1>
          <p className='truncate font-mono text-xs text-muted-foreground'>
            {runId}
          </p>
        </div>
        <div className='flex-1' />
        <ThemeSwitch />
      </Header>
      <Main className='flex flex-1 items-center justify-center'>
        <div className='max-w-md text-center'>
          {error ? (
            <>
              <AlertTriangle className='mx-auto size-7 text-amber-500' />
              <p className='mt-3 text-sm font-medium'>历史推理加载失败</p>
              <p className='mt-1 text-sm text-muted-foreground'>{error}</p>
              <Button
                type='button'
                variant='outline'
                className='mt-4'
                onClick={reload}
              >
                <RefreshCw />
                重新加载
              </Button>
            </>
          ) : (
            <>
              <Loader2 className='mx-auto size-7 animate-spin text-muted-foreground' />
              <p className='mt-3 text-sm text-muted-foreground'>
                正在加载历史推理记录...
              </p>
            </>
          )}
        </div>
      </Main>
    </div>
  )
}

