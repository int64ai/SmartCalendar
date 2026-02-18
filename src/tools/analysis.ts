/** Analysis tools (ported from analysis.py) */

import type { ICalendarBase } from '../data/calendar-base';
import type { Event } from '../shared/types';
import { toLocalISO } from './date-utils';

export async function checkConflicts(
  calendar: ICalendarBase,
  start: string,
  end: string,
): Promise<Event[]> {
  const newStart = new Date(start);
  const newEnd = new Date(end);

  // Query a wider window to catch edge overlaps
  const windowStart = new Date(newStart.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);

  const allEvents = await calendar.getEvents(
    toLocalISO(windowStart),
    toLocalISO(windowEnd),
  );

  const conflicts: Event[] = [];
  for (const event of allEvents) {
    const evStart = new Date(event.start);
    const evEnd = new Date(event.end);
    // Overlap: (A.start < B.end) AND (A.end > B.start)
    if (evStart < newEnd && evEnd > newStart) {
      conflicts.push(event);
    }
  }

  return conflicts;
}

export async function findRelatedEvents(
  calendar: ICalendarBase,
  titleKeyword: string,
  limit: number = 10,
): Promise<Event[]> {
  const allEvents = await calendar.getAllEvents();
  const keywordLower = titleKeyword.toLowerCase();
  const related: Event[] = [];

  for (const event of allEvents) {
    if (event.title.toLowerCase().includes(keywordLower)) {
      related.push(event);
      if (related.length >= limit) break;
    }
  }

  return related;
}

export async function getEventContext(
  calendar: ICalendarBase,
  eventId: string,
  hoursBefore: number = 3,
  hoursAfter: number = 3,
): Promise<Record<string, unknown>> {
  const targetEvent = await calendar.getEventById(eventId);
  if (!targetEvent) {
    return {
      error: `일정을 찾을 수 없습니다: ${eventId}`,
      event: null,
      before: [],
      after: [],
    };
  }

  const targetStart = new Date(targetEvent.start);
  const targetEnd = new Date(targetEvent.end);
  const beforeStart = new Date(
    targetStart.getTime() - hoursBefore * 60 * 60 * 1000,
  );
  const afterEnd = new Date(
    targetEnd.getTime() + hoursAfter * 60 * 60 * 1000,
  );

  const allEvents = await calendar.getEvents(
    toLocalISO(beforeStart),
    toLocalISO(afterEnd),
  );

  const beforeEvents: Event[] = [];
  const afterEvents: Event[] = [];

  for (const event of allEvents) {
    if (event.id === eventId) continue;

    const evEnd = new Date(event.end);
    const evStart = new Date(event.start);

    if (evEnd <= targetStart) {
      beforeEvents.push(event);
    } else if (evStart >= targetEnd) {
      afterEvents.push(event);
    }
  }

  return {
    event: targetEvent,
    before: beforeEvents,
    after: afterEvents,
  };
}
