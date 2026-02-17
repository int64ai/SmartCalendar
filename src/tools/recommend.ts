/** Recommendation tools (ported from recommend.py) */

import type { DexieCalendar } from '../data/calendar';
import type { Event } from '../shared/types';
import { Category } from '../shared/types';
import { parseDate, parseTime, toLocalISO } from './date-utils';

export function calculateTimeScore(dt: Date): number {
  const hour = dt.getHours();
  if (hour >= 10 && hour <= 11) return 100;
  if (hour >= 14 && hour <= 15) return 95;
  if (hour >= 9 && hour <= 12) return 80;
  if (hour >= 13 && hour <= 17) return 70;
  return 50;
}

export async function suggestOptimalTimes(
  calendar: DexieCalendar,
  durationMinutes: number,
  preferredDates: string[],
  constraints?: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const c = constraints ?? {};
  const timeRange = (c.time_range as string[]) ?? ['09:00', '18:00'];
  const avoidCategories = (c.avoid_categories as string[]) ?? [];
  const bufferMinutes = (c.buffer_minutes as number) ?? 0;

  const [startHour, startMin] = parseTime(timeRange[0]!);
  const [endHour, endMin] = parseTime(timeRange[1]!);

  const suggestions: Record<string, unknown>[] = [];

  for (const dateStr of preferredDates) {
    const targetDate = parseDate(dateStr);
    const dayStart = new Date(targetDate);
    dayStart.setHours(startHour, startMin, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(endHour, endMin, 0, 0);

    let events = await calendar.getEvents(
      toLocalISO(dayStart),
      toLocalISO(dayEnd),
    );

    // Filter out avoided categories
    if (avoidCategories.length > 0) {
      events = events.filter((e) => {
        const cat =
          Object.values(Category).includes(e.category as Category)
            ? e.category
            : e.category;
        return !avoidCategories.includes(cat);
      });
    }

    let currentTime = dayStart.getTime();

    for (const event of events) {
      const evStartMs =
        new Date(event.start).getTime() - bufferMinutes * 60000;
      const evEndMs =
        new Date(event.end).getTime() + bufferMinutes * 60000;

      if (evStartMs > currentTime) {
        const gapMinutes = (evStartMs - currentTime) / 60000;
        if (gapMinutes >= durationMinutes) {
          const slotStart = new Date(currentTime);
          suggestions.push({
            date: dateStr,
            start: slotStart.toISOString(),
            end: new Date(
              currentTime + durationMinutes * 60000,
            ).toISOString(),
            available_until: new Date(evStartMs).toISOString(),
            score: calculateTimeScore(slotStart),
          });
        }
      }

      if (evEndMs > currentTime) {
        currentTime = evEndMs;
      }
    }

    // After last event to day end
    const dayEndMs = dayEnd.getTime();
    if (currentTime < dayEndMs) {
      const gapMinutes = (dayEndMs - currentTime) / 60000;
      if (gapMinutes >= durationMinutes) {
        const slotStart = new Date(currentTime);
        suggestions.push({
          date: dateStr,
          start: slotStart.toISOString(),
          end: new Date(
            currentTime + durationMinutes * 60000,
          ).toISOString(),
          available_until: dayEnd.toISOString(),
          score: calculateTimeScore(slotStart),
        });
      }
    }
  }

  // Sort by score descending
  suggestions.sort(
    (a, b) => (b.score as number) - (a.score as number),
  );

  return suggestions.slice(0, 5);
}

export async function proposeScheduleAdjustment(
  calendar: DexieCalendar,
  newEvent: Record<string, unknown>,
  strategy: string = 'minimize_moves',
): Promise<Record<string, unknown>[]> {
  const newStart = new Date(newEvent.start as string);
  const newEnd = new Date(newEvent.end as string);
  const newTitle = (newEvent.title as string) ?? '새 일정';
  const newPriority = (newEvent.priority as number) ?? 3;

  // Find events in a wider window
  const windowStart = new Date(
    newStart.getTime() - 2 * 60 * 60 * 1000,
  );
  const windowEnd = new Date(newEnd.getTime() + 2 * 60 * 60 * 1000);

  const allEvents = await calendar.getEvents(
    toLocalISO(windowStart),
    toLocalISO(windowEnd),
  );

  const conflicts: Event[] = [];
  for (const event of allEvents) {
    const evStart = new Date(event.start);
    const evEnd = new Date(event.end);
    if (evStart < newEnd && evEnd > newStart) {
      conflicts.push(event);
    }
  }

  // No conflicts -> create directly
  if (conflicts.length === 0) {
    return [
      {
        action: 'create',
        event_id: null,
        proposed: {
          title: newTitle,
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
        },
        reason: '충돌하는 일정이 없어 바로 생성 가능합니다.',
      },
    ];
  }

  switch (strategy) {
    case 'respect_priority':
      return strategyRespectPriority(
        conflicts,
        newStart,
        newEnd,
        newTitle,
        newPriority,
      );
    case 'keep_buffer':
      return strategyKeepBuffer(conflicts, newStart, newEnd, newTitle);
    case 'minimize_moves':
    default:
      return strategyMinimizeMoves(
        conflicts,
        newStart,
        newEnd,
        newTitle,
      );
  }
}

function formatTimeDiff(original: Date, proposed: Date): string {
  const diffMs = proposed.getTime() - original.getTime();
  let minutes = Math.round(diffMs / 60000);

  if (minutes >= 0) {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins ? `${hours}시간 ${mins}분 뒤로` : `${hours}시간 뒤로`;
    }
    return `${minutes}분 뒤로`;
  } else {
    minutes = Math.abs(minutes);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins
        ? `${hours}시간 ${mins}분 앞으로`
        : `${hours}시간 앞으로`;
    }
    return `${minutes}분 앞으로`;
  }
}

function strategyMinimizeMoves(
  conflicts: Event[],
  newStart: Date,
  newEnd: Date,
  newTitle: string,
): Record<string, unknown>[] {
  const proposals: Record<string, unknown>[] = [];

  for (const event of conflicts) {
    if (event.is_movable) {
      const evDuration =
        new Date(event.end).getTime() - new Date(event.start).getTime();
      const proposedStart = newEnd;
      const proposedEnd = new Date(newEnd.getTime() + evDuration);

      proposals.push({
        action: 'move',
        event_id: event.id,
        event_title: event.title,
        original: { start: event.start, end: event.end },
        proposed: {
          start: proposedStart.toISOString(),
          end: proposedEnd.toISOString(),
        },
        reason: `'${newTitle}' 일정을 위해 '${event.title}'을(를) ${formatTimeDiff(new Date(event.start), proposedStart)} 이동`,
      });
    } else {
      proposals.push({
        action: 'conflict',
        event_id: event.id,
        event_title: event.title,
        original: { start: event.start, end: event.end },
        proposed: null,
        reason: `'${event.title}'은(는) 이동 불가능한 일정입니다. 다른 시간을 선택해주세요.`,
      });
    }
  }

  if (proposals.every((p) => p.action === 'move')) {
    proposals.unshift({
      action: 'create',
      event_id: null,
      proposed: {
        title: newTitle,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      },
      reason: `'${newTitle}' 일정을 생성하고, 충돌하는 일정을 이동합니다.`,
    });
  }

  return proposals;
}

function strategyRespectPriority(
  conflicts: Event[],
  _newStart: Date,
  newEnd: Date,
  newTitle: string,
  newPriority: number,
): Record<string, unknown>[] {
  const proposals: Record<string, unknown>[] = [];

  for (const event of conflicts) {
    if (event.priority > newPriority && event.is_movable) {
      const evDuration =
        new Date(event.end).getTime() - new Date(event.start).getTime();
      const proposedStart = newEnd;
      const proposedEnd = new Date(newEnd.getTime() + evDuration);

      proposals.push({
        action: 'move',
        event_id: event.id,
        event_title: event.title,
        original: { start: event.start, end: event.end },
        proposed: {
          start: proposedStart.toISOString(),
          end: proposedEnd.toISOString(),
        },
        reason: `'${event.title}'(우선순위 ${event.priority})보다 '${newTitle}'(우선순위 ${newPriority})이 더 중요하여 이동`,
      });
    } else {
      proposals.push({
        action: 'conflict',
        event_id: event.id,
        event_title: event.title,
        priority: event.priority,
        original: { start: event.start, end: event.end },
        proposed: null,
        reason: `'${event.title}'(우선순위 ${event.priority})이 '${newTitle}'(우선순위 ${newPriority})보다 중요하거나 같아 이동 불가`,
      });
    }
  }

  return proposals;
}

function strategyKeepBuffer(
  conflicts: Event[],
  _newStart: Date,
  newEnd: Date,
  newTitle: string,
  bufferMinutes: number = 15,
): Record<string, unknown>[] {
  const proposals: Record<string, unknown>[] = [];
  const bufferMs = bufferMinutes * 60000;

  for (const event of conflicts) {
    if (event.is_movable) {
      const evDuration =
        new Date(event.end).getTime() - new Date(event.start).getTime();
      const proposedStart = new Date(newEnd.getTime() + bufferMs);
      const proposedEnd = new Date(proposedStart.getTime() + evDuration);

      proposals.push({
        action: 'move',
        event_id: event.id,
        event_title: event.title,
        original: { start: event.start, end: event.end },
        proposed: {
          start: proposedStart.toISOString(),
          end: proposedEnd.toISOString(),
        },
        reason: `'${newTitle}' 후 ${bufferMinutes}분 여유를 두고 '${event.title}' 이동`,
      });
    } else {
      proposals.push({
        action: 'conflict',
        event_id: event.id,
        event_title: event.title,
        original: { start: event.start, end: event.end },
        proposed: null,
        reason: `'${event.title}'은(는) 이동 불가능합니다.`,
      });
    }
  }

  return proposals;
}
