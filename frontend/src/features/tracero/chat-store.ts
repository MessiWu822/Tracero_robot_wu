import { create } from 'zustand'
import { mockCurrentRun } from './mock-data'

export type ChatMessageRole = 'user' | 'assistant'

export type ChatContext = {
  perspective: 'general' | 'dev' | 'test' | 'ops'
  evidence_id?: string
  repository?: string
  commit?: string
  filePath?: string
  line?: number
  functionName?: string
  module?: string
  testCaseId?: string
}

export type ChatMessage = {
  id: string
  role: ChatMessageRole
  content: string
  createdAt?: Date
  context?: ChatContext
}

type ChatState = {
  conversations: Record<string, ChatMessage[]>
  addMessage: (runId: string, message: Omit<ChatMessage, 'id'>) => void
}

const initialConversations: Record<string, ChatMessage[]> = {
  [mockCurrentRun.run_id]: mockCurrentRun.chatHistory.map((message, index) => ({
    id: `${mockCurrentRun.run_id}-${index + 1}`,
    role: message.role === 'ai' ? 'assistant' : 'user',
    content: message.content,
  })),
}

export const useTraceroChatStore = create<ChatState>()((set) => ({
  conversations: initialConversations,
  addMessage: (runId, message) =>
    set((state) => {
      const messages = state.conversations[runId] ?? []

      return {
        conversations: {
          ...state.conversations,
          [runId]: [
            ...messages,
            {
              ...message,
              id: `${runId}-${Date.now()}`,
              createdAt: new Date(),
            },
          ],
        },
      }
    }),
}))
