import { useState, useEffect, useCallback } from 'react'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [currentRange, setCurrentRange] = useState<{ timeMin: string; timeMax: string } | null>(null)

  useEffect(() => {
    const listener = (msg: { type: string; payload?: Record<string, unknown> }) => {
      if (msg.type === 'GOOGLE_EVENTS_RESULT') {
        const items = (msg.payload?.events as CalendarEvent[]) ?? []
        setEvents(items)
        setLoading(false)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const fetchEvents = useCallback((timeMin: string, timeMax: string) => {
    setLoading(true)
    setCurrentRange({ timeMin, timeMax })
    chrome.runtime.sendMessage({
      type: 'GOOGLE_FETCH_EVENTS',
      payload: { timeMin, timeMax },
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const refetch = useCallback(() => {
    if (currentRange) {
      fetchEvents(currentRange.timeMin, currentRange.timeMax)
    }
  }, [currentRange, fetchEvents])

  return { events, loading, fetchEvents, refetch }
}
