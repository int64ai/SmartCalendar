/** Query tools (ported from query.py) */

import type { ICalendarBase } from '../data/calendar-base';
import type { Event, TimeSlot } from '../shared/types';
import { DEFAULT_WORK_HOURS } from '../shared/constants';
import { parseDate, parseTime, toLocalISO } from './date-utils';

export async function getEvents(
  calendar: ICalendarBase,
  startDate: string,
  endDate: string,
  category?: string,
  tags?: string[],
): Promise<Event[]> {
  // If end date is date-only, extend to end of day
  let adjustedEnd = endDate;
  if (!endDate.includes('T')) {
    adjustedEnd = endDate + 'T23:59:59';
  }

  return calendar.getEvents(startDate, adjustedEnd, category, tags);
}

export async function searchEvents(
  calendar: ICalendarBase,
  query: string,
  startDate?: string,
  endDate?: string,
): Promise<Event[]> {
  let adjustedEnd = endDate;
  if (endDate && !endDate.includes('T')) {
    adjustedEnd = endDate + 'T23:59:59';
  }

  return calendar.searchEvents(query, startDate, adjustedEnd);
}

export async function getFreeSlots(
  calendar: ICalendarBase,
  date: string,
  durationMinutes: number,
  timeRange?: [string, string],
): Promise<TimeSlot[]> {
  const [startHour, startMin] = timeRange
    ? parseTime(timeRange[0])
    : parseTime(DEFAULT_WORK_HOURS[0]);
  const [endHour, endMin] = timeRange
    ? parseTime(timeRange[1])
    : parseTime(DEFAULT_WORK_HOURS[1]);

  const targetDate = parseDate(date);
  const dayStart = new Date(targetDate);
  dayStart.setHours(startHour, startMin, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(endHour, endMin, 0, 0);

  const dayStartISO = toLocalISO(dayStart);
  const dayEndISO = toLocalISO(dayEnd);

  const events = await calendar.getEvents(dayStartISO, dayEndISO);

  const freeSlots: TimeSlot[] = [];
  let currentTime = dayStart.getTime();

  for (const event of events) {
    const evStart = new Date(event.start).getTime();
    const evEnd = new Date(event.end).getTime();

    if (evStart > currentTime) {
      const gapMinutes = (evStart - currentTime) / 60000;
      if (gapMinutes >= durationMinutes) {
        freeSlots.push({
          start: toLocalISO(new Date(currentTime)),
          end: toLocalISO(new Date(evStart)),
        });
      }
    }

    if (evEnd > currentTime) {
      currentTime = evEnd;
    }
  }

  // Check remaining time after last event
  const dayEndMs = dayEnd.getTime();
  if (currentTime < dayEndMs) {
    const gapMinutes = (dayEndMs - currentTime) / 60000;
    if (gapMinutes >= durationMinutes) {
      freeSlots.push({
        start: toLocalISO(new Date(currentTime)),
        end: dayEndISO,
      });
    }
  }

  return freeSlots;
}
