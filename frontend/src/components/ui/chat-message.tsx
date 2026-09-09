import type { ReactNode } from 'react'
import { Bot, Code2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatContext } from '@/features/tracero/chat-store'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: Date
  context?: ChatContext
}

type ChatMessageProps = Message & {
  showTimeStamp?: boolean
  actions?: ReactNode
}

export function ChatMessage({
  role,
  content,
  createdAt,
  context,
  showTimeStamp = false,
  actions,
}: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex animate-in items-start gap-2.5 duration-300 fade-in-0',
        isUser && 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border',
          isUser
            ? 'border-blue-300 bg-blue-200 text-blue-700'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className='size-3.5' /> : <Bot className='size-3.5' />}
      </div>

      <div
        className={cn(
          'group/message flex max-w-[84%] flex-col',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {context?.filePath && (
          <div className='mb-1 flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-2 py-1 font-mono text-[9px] text-muted-foreground'>
            <Code2 className='size-3 shrink-0' />
            <span className='truncate'>
              {context.filePath}
              {context.line ? `:${context.line}` : ''}
            </span>
          </div>
        )}
        <div
          className={cn(
            'relative rounded-xl px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap',
            isUser
              ? 'rounded-tr-sm bg-blue-300/50 text-black dark:bg-slate-700/85 dark:text-white'
              : 'rounded-tl-sm border bg-card text-card-foreground shadow-xs'
          )}
        >
          {content}
          {actions && (
            <div className='absolute right-1 -bottom-5 flex opacity-0 transition-opacity group-hover/message:opacity-100'>
              {actions}
            </div>
          )}
        </div>

        {showTimeStamp && createdAt && (
          <time
            dateTime={createdAt.toISOString()}
            className='mt-1 px-1 text-[10px] text-muted-foreground'
          >
            {createdAt.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        )}
      </div>
    </div>
  )
}
