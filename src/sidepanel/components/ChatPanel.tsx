import { useState, useRef, useEffect, useCallback } from 'react'
import { PaperAirplaneIcon, ArrowPathIcon, StopIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import ChatMessage from './ChatMessage'
import { useChat } from '../hooks/useChat'

interface ChatPanelProps {
  onOpenSettings: () => void
  calendarContext?: { viewing_date: string; view_type: string }
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'get_events': '일정 조회 중...',
  'search_events': '일정 검색 중...',
  'create_event': '일정 생성 중...',
  'update_event': '일정 수정 중...',
  'delete_event': '일정 삭제 중...',
  'undo_event': '되돌리는 중...',
  'get_free_slots': '빈 시간 찾는 중...',
  'check_conflicts': '충돌 확인 중...',
  'find_related_events': '관련 일정 검색 중...',
  'get_event_context': '전후 일정 확인 중...',
  'suggest_optimal_times': '최적 시간 찾는 중...',
  'propose_schedule_adjustment': '일정 조정 방안 분석 중...',
  'analyze_user_patterns': '캘린더 패턴 분석 중...',
  'update_persona': '프로필 업데이트 중...',
}

function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || `${toolName} 실행 중...`
}

export default function ChatPanel({ onOpenSettings, calendarContext }: ChatPanelProps) {
  const {
    messages,
    isLoading,
    currentTool,
    sendMessage,
    retryMessage,
    cancelMessage,
    clearChat
  } = useChat()

  const [input, setInput] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim(), calendarContext)
    setInput('')
  }, [input, isLoading, sendMessage, calendarContext])

  const handleRetry = useCallback(() => {
    retryMessage()
  }, [retryMessage])

  const handleCancel = useCallback(() => {
    cancelMessage()
  }, [cancelMessage])

  const handleClear = useCallback(() => {
    clearChat()
    setShowClearConfirm(false)
  }, [clearChat])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
          <span className="font-medium">AI 비서</span>
          {currentTool && (
            <span className="text-xs text-text-secondary bg-surface-hover px-2 py-0.5 rounded">
              {getToolDisplayName(currentTool)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
            title="대화 초기화"
          >
            <ArrowPathIcon className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
            title="설정"
          >
            <Cog6ToothIcon className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Clear confirmation banner */}
      {showClearConfirm && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/30 flex items-center justify-between">
          <span className="text-sm text-text-secondary">대화를 초기화할까요?</span>
          <div className="flex gap-2">
            <button onClick={handleClear} className="text-sm text-error font-medium hover:underline">초기화</button>
            <button onClick={() => setShowClearConfirm(false)} className="text-sm text-text-secondary hover:underline">취소</button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div key={message.id}>
            <ChatMessage message={message} />
            {message.isError && (
              <div className="flex justify-start mt-1 ml-1">
                <button
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="text-xs text-accent hover:text-accent-hover font-medium disabled:opacity-50"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && !messages.some(m => m.isStreaming && m.content) && (
          <div className="flex items-center gap-2 text-text-secondary">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">응답 생성 중...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={isLoading}
            className="input flex-1"
          />
          {isLoading ? (
            <button
              onClick={handleCancel}
              className="btn-ghost px-3 text-error"
              title="취소"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="btn-primary px-3"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
