import { useMemo } from 'react'
import { MapPinIcon, ClockIcon } from '@heroicons/react/24/outline'
import type { CalendarEvent } from '../hooks/useCalendarEvents'

interface AgendaListProps {
  selectedDate: Date
  events: CalendarEvent[]
  loading: boolean
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours < 12 ? '오전' : '오후'
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return minutes === 0 ? `${period} ${h}시` : `${period} ${h}시 ${minutes}분`
}

function isAllDay(start: string, end: string): boolean {
  return start.includes('T00:00:00') && (end.includes('T23:59:59') || end.includes('T00:00:00'))
}

function getTimeColor(hours: number): string {
  if (hours < 9) return 'border-l-purple-400'
  if (hours < 12) return 'border-l-blue-400'
  if (hours < 14) return 'border-l-green-400'
  if (hours < 17) return 'border-l-orange-400'
  return 'border-l-rose-400'
}

export default function AgendaList({ selectedDate, events, loading }: AgendaListProps) {
  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = WEEKDAYS[selectedDate.getDay()]
  const isToday = (() => {
    const today = new Date()
    return selectedDate.getFullYear() === today.getFullYear() &&
           selectedDate.getMonth() === today.getMonth() &&
           selectedDate.getDate() === today.getDate()
  })()

  const dayEvents = useMemo(() => {
    return events
      .filter(ev => {
        const evDate = ev.start.split('T')[0]
        return evDate === dateStr
      })
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [events, dateStr])

  const dateLabel = `${selectedDate.getMonth() + 1}/${selectedDate.getDate()} (${weekday})`

  return (
    <div className="flex flex-col">
      {/* Date header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-sm font-semibold">
          {isToday && <span className="text-accent mr-1">오늘</span>}
          {dateLabel}
        </span>
        <span className="text-xs text-text-secondary font-medium">
          {dayEvents.length === 0 ? '일정 없음' : `${dayEvents.length}개 일정`}
        </span>
        {loading && (
          <span className="ml-auto flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
          </span>
        )}
      </div>

      {/* Event list */}
      <div className="overflow-y-auto max-h-36 scrollbar-thin">
        {dayEvents.length === 0 && !loading ? (
          <div className="px-4 py-4 text-center text-sm text-text-tertiary">
            이 날에는 일정이 없습니다
          </div>
        ) : (
          <div className="py-1">
            {dayEvents.map(ev => {
              const allDay = isAllDay(ev.start, ev.end)
              const startHour = new Date(ev.start).getHours()
              const colorClass = getTimeColor(startHour)

              return (
                <div
                  key={ev.id}
                  className={`mx-2 my-0.5 px-3 py-2 rounded-lg border-l-[3px] ${colorClass}
                              bg-surface hover:bg-surface-hover transition-colors cursor-default`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{ev.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-2xs text-text-tertiary">
                      <ClockIcon className="w-3 h-3" />
                      {allDay ? '종일' : `${formatTime(ev.start)} ~ ${formatTime(ev.end)}`}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1 text-2xs text-text-tertiary truncate">
                        <MapPinIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
