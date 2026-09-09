import { ChatMessage, type Message } from '@/components/ui/chat-message'

type MessageListProps = {
  messages: Message[]
  showTimeStamps?: boolean
  isTyping?: boolean
}

export function MessageList({
  messages,
  showTimeStamps = false,
  isTyping = false,
}: MessageListProps) {
  return (
    <div className='space-y-4'>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          {...message}
          showTimeStamp={showTimeStamps}
        />
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className='flex items-center gap-2.5' aria-label='AI 正在生成回复'>
      <div className='flex size-7 items-center justify-center rounded-full border bg-muted'>
        <span className='size-1.5 animate-pulse rounded-full bg-muted-foreground' />
      </div>
      <div className='flex items-center gap-1 rounded-xl rounded-tl-sm border bg-card px-3 py-3 shadow-xs'>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className='size-1.5 animate-bounce rounded-full bg-muted-foreground/70'
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
