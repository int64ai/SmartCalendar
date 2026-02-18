import { useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { CalendarEvent } from '../hooks/useCalendarEvents'

interface MiniCalendarProps {
  currentDate: Date
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  events: CalendarEvent[]
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function MiniCalendar({
  currentDate,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  events,
}: MiniCalendarProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Build event-date set for dot indicators
  const eventDates = useMemo(() => {
    const dates = new Set<string>()
    for (const ev of events) {
      const start = new Date(ev.start)
      dates.add(`${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`)
      // Multi-day events: mark each day
      const end = new Date(ev.end)
      const current = new Date(start)
      while (current <= end) {
        dates.add(`${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`)
        current.setDate(current.getDate() + 1)
      }
    }
    return dates
  }, [events])

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startDay = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: Array<{ date: Date; inMonth: boolean }> = []

    // Previous month trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        inMonth: false,
      })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        inMonth: true,
      })
    }

    // Next month leading days
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        inMonth: false,
      })
    }

    return days
  }, [year, month])

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`

  const monthLabel = `${year}년 ${month + 1}월`

  return (
    <div className="px-3 pt-3 pb-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrevMonth}
          className="p-1 rounded-md hover:bg-surface-hover transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={onToday}
          className="text-sm font-semibold hover:text-accent transition-colors"
        >
          {monthLabel}
        </button>
        <button
          onClick={onNextMonth}
          className="p-1 rounded-md hover:bg-surface-hover transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-2xs font-medium py-0.5 ${
              i === 0 ? 'text-error/70' : i === 6 ? 'text-accent/70' : 'text-text-tertiary'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map(({ date, inMonth }, idx) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          const isToday = dateKey === todayKey
          const isSelected = dateKey === selectedKey
          const hasEvent = eventDates.has(dateKey)
          const dayOfWeek = date.getDay()

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`
                relative flex flex-col items-center justify-center
                h-8 rounded-md text-xs transition-all duration-100
                ${!inMonth ? 'text-text-tertiary/30 opacity-40' : ''}
                ${inMonth && dayOfWeek === 0 ? 'text-error/80' : ''}
                ${inMonth && dayOfWeek === 6 ? 'text-accent/80' : ''}
                ${isSelected ? 'bg-accent text-white font-semibold' : 'hover:bg-surface-hover'}
                ${isToday && !isSelected ? 'font-bold text-accent ring-1 ring-accent/40 rounded-md' : ''}
              `}
            >
              <span className="leading-none">{date.getDate()}</span>
              {hasEvent && !isSelected && inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent" />
              )}
              {hasEvent && !isSelected && !inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent/30" />
              )}
              {hasEvent && isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
