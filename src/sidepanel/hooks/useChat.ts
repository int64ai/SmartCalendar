import { useState, useEffect, useCallback, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
}

const WELCOME_MESSAGE: Message = {
  id: '1',
  role: 'bot',
  content: '안녕하세요! 스마트 캘린더 비서입니다.\n일정 조회, 검색, 생성 등 무엇이든 물어보세요!',
  timestamp: new Date()
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const accumulatedRef = useRef('')
  const botMessageIdRef = useRef<string | null>(null)
  const lastCalendarContextRef = useRef<{ viewing_date: string; view_type: string } | undefined>()

  useEffect(() => {
    const listener = (msg: { type: string; payload?: Record<string, unknown> }) => {
      if (msg.type === 'STREAM_CHUNK') {
        accumulatedRef.current += (msg.payload?.content as string) ?? ''
        const content = accumulatedRef.current
        const id = botMessageIdRef.current
        if (id) {
          setMessages(prev => prev.map(m =>
            m.id === id ? { ...m, content } : m
          ))
        }
      } else if (msg.type === 'STREAM_TOOL') {
        setCurrentTool((msg.payload?.name as string) ?? null)
      } else if (msg.type === 'STREAM_DONE') {
        const content = (msg.payload?.fullText as string) || accumulatedRef.current
        const id = botMessageIdRef.current
        if (id) {
          setMessages(prev => prev.map(m =>
            m.id === id ? { ...m, content, isStreaming: false } : m
          ))
        }
        setIsLoading(false)
        setCurrentTool(null)
        setLastFailedMessage(null)
        botMessageIdRef.current = null
      } else if (msg.type === 'STREAM_ERROR') {
        const id = botMessageIdRef.current
        const errorMsg = (msg.payload?.error as string) ?? '오류가 발생했습니다.'
        if (id) {
          setMessages(prev => prev.map(m =>
            m.id === id ? { ...m, content: errorMsg, isStreaming: false, isError: true } : m
          ))
        }
        setIsLoading(false)
        setCurrentTool(null)
        botMessageIdRef.current = null
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const sendMessage = useCallback((messageContent: string, calendarContext?: { viewing_date: string; view_type: string }) => {
    if (!messageContent.trim() || isLoading) return

    lastCalendarContextRef.current = calendarContext

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date()
    }

    const botMessageId = (Date.now() + 1).toString()
    botMessageIdRef.current = botMessageId
    accumulatedRef.current = ''

    setMessages(prev => [...prev, userMessage, {
      id: botMessageId,
      role: 'bot',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }])
    setIsLoading(true)
    setCurrentTool(null)
    setLastFailedMessage(messageContent.trim())

    chrome.runtime.sendMessage({
      type: 'CHAT_REQUEST',
      payload: { message: messageContent.trim(), calendarContext }
    }).catch(() => { /* SW may be starting up */ })
  }, [isLoading])

  const retryMessage = useCallback(() => {
    if (!lastFailedMessage || isLoading) return

    // Remove the error bot message AND the duplicate user message
    // so the service worker re-adds the user message cleanly
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.isError) {
        const withoutError = prev.slice(0, -1)
        // Also remove the user message right before it (to avoid duplicate)
        const secondLast = withoutError[withoutError.length - 1]
        if (secondLast?.role === 'user' && secondLast.content === lastFailedMessage) {
          return withoutError.slice(0, -1)
        }
        return withoutError
      }
      return prev
    })

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: lastFailedMessage,
      timestamp: new Date()
    }

    const botMessageId = (Date.now() + 1).toString()
    botMessageIdRef.current = botMessageId
    accumulatedRef.current = ''

    setMessages(prev => [...prev, userMessage, {
      id: botMessageId,
      role: 'bot',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }])
    setIsLoading(true)
    setCurrentTool(null)

    chrome.runtime.sendMessage({
      type: 'CHAT_REQUEST',
      payload: { message: lastFailedMessage, calendarContext: lastCalendarContextRef.current }
    }).catch(() => { /* SW may be starting up */ })
  }, [lastFailedMessage, isLoading])

  const cancelMessage = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CHAT_CANCEL' }).catch(() => {})
    const id = botMessageIdRef.current
    if (id) {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, content: m.content || '(취소됨)', isStreaming: false } : m
      ))
    }
    setIsLoading(false)
    setCurrentTool(null)
    botMessageIdRef.current = null
  }, [])

  const clearChat = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CHAT_CLEAR' }).catch(() => {})
    setMessages([{
      id: Date.now().toString(),
      role: 'bot',
      content: '대화가 초기화되었습니다.\n무엇을 도와드릴까요?',
      timestamp: new Date()
    }])
    setLastFailedMessage(null)
    setIsLoading(false)
    setCurrentTool(null)
    botMessageIdRef.current = null
  }, [])

  return {
    messages,
    isLoading,
    currentTool,
    lastFailedMessage,
    sendMessage,
    retryMessage,
    cancelMessage,
    clearChat
  }
}
