import { useState, useEffect, useCallback } from 'react'
import ChatPanel from './components/ChatPanel'
import SettingsPage from './components/SettingsPage'
import GoogleLoginPage from './components/GoogleLoginPage'
import MiniCalendar from './components/MiniCalendar'
import AgendaList from './components/AgendaList'
import ToastProvider from './components/Toast/ToastProvider'
import { useTheme } from './hooks/useTheme'
import { useSettings, isSettingsConfigured } from './hooks/useSettings'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

export default function App() {
  const [page, setPage] = useState<'main' | 'settings'>('main')
  useTheme()
  const { settings } = useSettings()
  const { signedIn, loading: authLoading, error: authError, signIn, signOut } = useGoogleAuth()
  const { events, loading: eventsLoading, fetchEvents, refetch } = useCalendarEvents()

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarCollapsed, setCalendarCollapsed] = useState(false)

  // Fetch events when month changes or when signed in
  useEffect(() => {
    if (!signedIn) return
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month + 2, 0)
    fetchEvents(
      start.toISOString().split('T')[0]!,
      end.toISOString().split('T')[0]!,
    )
  }, [signedIn, currentDate, fetchEvents])

  // Listen for calendar mutations and refetch immediately
  useEffect(() => {
    const listener = (msg: { type: string }) => {
      if (msg.type === 'EVENTS_CHANGED') {
        // Mutation tool was called — refetch immediately
        refetch()
      } else if (msg.type === 'STREAM_DONE') {
        // Safety net: refetch after AI chat completes in case EVENTS_CHANGED was missed
        setTimeout(() => refetch(), 300)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [refetch])

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const handleToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }, [])

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    // If selected date is in a different month, navigate to it
    if (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }, [currentDate])

  // Calendar context for AI
  const calendarContext = {
    viewing_date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
    view_type: 'month',
  }

  const configured = isSettingsConfigured(settings)

  // Loading state
  if (authLoading) {
    return (
      <ToastProvider>
        <div className="h-screen flex flex-col bg-background items-center justify-center">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </ToastProvider>
    )
  }

  // Not signed in to Google
  if (!signedIn) {
    return (
      <ToastProvider>
        <div className="h-screen flex flex-col bg-background">
          <GoogleLoginPage onSignIn={signIn} loading={authLoading} error={authError} />
        </div>
      </ToastProvider>
    )
  }

  // Settings not configured (no AI provider)
  if (!configured && page !== 'settings') {
    return (
      <ToastProvider>
        <div className="h-screen flex flex-col bg-background">
          <SettingsPage
            onBack={() => setPage('main')}
            showBackButton={false}
            onSignOut={signOut}
          />
        </div>
      </ToastProvider>
    )
  }

  // Main + Settings: both rendered, toggle visibility via CSS to preserve ChatPanel state
  return (
    <ToastProvider>
      {/* Settings overlay */}
      <div className={`h-screen flex flex-col bg-background ${page === 'settings' ? '' : 'hidden'}`}>
        <SettingsPage
          onBack={() => setPage('main')}
          showBackButton={true}
          onSignOut={signOut}
        />
      </div>

      {/* Main view: Calendar + Chat (always mounted, hidden when settings is open) */}
      <div className={`h-screen flex flex-col bg-background ${page === 'main' ? '' : 'hidden'}`}>
        {/* Collapsible calendar section */}
        <div className="border-b border-border bg-surface/50">
          <button
            onClick={() => setCalendarCollapsed(!calendarCollapsed)}
            className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-surface-hover transition-colors"
          >
            <span className="text-2xs font-medium text-text-secondary">
              {calendarCollapsed ? '캘린더 펼치기' : '캘린더 접기'}
            </span>
            {calendarCollapsed ? (
              <ChevronDownIcon className="w-3.5 h-3.5 text-text-tertiary" />
            ) : (
              <ChevronUpIcon className="w-3.5 h-3.5 text-text-tertiary" />
            )}
          </button>

          {!calendarCollapsed && (
            <>
              <MiniCalendar
                currentDate={currentDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
                events={events}
              />
              <AgendaList
                selectedDate={selectedDate}
                events={events}
                loading={eventsLoading}
              />
            </>
          )}
        </div>

        <ChatPanel
          onOpenSettings={() => setPage('settings')}
          calendarContext={calendarContext}
        />
      </div>
    </ToastProvider>
  )
}
