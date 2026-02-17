import { marked } from 'marked'

// Configure marked for GFM (tables, strikethrough) and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
})

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: Message
}

function formatContent(content: string): string {
  return marked.parse(content, { async: false }) as string
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 30) return '방금 전'
  if (diffMin < 1) return `${diffSec}초 전`
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-accent text-white rounded-br-md'
              : 'bg-surface-hover text-text-primary rounded-bl-md'
          }`}
        >
          <div
            className="chat-markdown text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse rounded-sm" />
          )}
        </div>
        <div className={`text-2xs text-text-tertiary mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {getRelativeTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
