import { useEffect, useRef } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type MessageInputProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value'
> & {
  value: string
  isGenerating: boolean
  submitOnEnter?: boolean
}

export function MessageInput({
  value,
  isGenerating,
  submitOnEnter = true,
  className,
  onKeyDown,
  ...props
}: MessageInputProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textArea = textAreaRef.current
    if (!textArea) return

    textArea.style.height = '0px'
    textArea.style.height = `${Math.min(textArea.scrollHeight, 160)}px`
  }, [value])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      submitOnEnter &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }

    onKeyDown?.(event)
  }

  return (
    <div className='relative'>
      <textarea
        ref={textAreaRef}
        value={value}
        rows={1}
        aria-label='输入追问'
        className={cn(
          'min-h-11 w-full resize-none rounded-xl border bg-background px-3 py-2.5 pr-12 text-sm leading-6 transition-[border,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
        onKeyDown={handleKeyDown}
        disabled={isGenerating}
        {...props}
      />
      <Button
        type='submit'
        size='icon'
        className='absolute right-1.5 bottom-1.5 z-10 size-8 rounded-lg'
        disabled={!value.trim() || isGenerating}
        aria-label={isGenerating ? '正在生成' : '发送消息'}
      >
        {isGenerating ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <ArrowUp className='size-4' />
        )}
      </Button>
    </div>
  )
}
