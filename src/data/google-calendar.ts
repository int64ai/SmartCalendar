/** Google Calendar adapter — implements ICalendarBase using Google Calendar API */

import type { ICalendarBase } from './calendar-base';
import type { Event } from '../shared/types';
import * as gcal from '../api/google-calendar';
import type { GoogleCalendarEvent } from '../api/google-calendar';

const PRIMARY = 'primary';

// ── Convert between internal Event and Google Calendar Event ──

function gcalToEvent(g: GoogleCalendarEvent): Event {
  const ext = g.extendedProperties?.private ?? {};
  return {
    id: g.id,
    title: g.summary ?? '(제목 없음)',
    start: g.start.dateTime ?? `${g.start.date}T00:00:00`,
    end: g.end.dateTime ?? `${g.end.date}T23:59:59`,
    description: g.description,
    location: g.location,
    category: ext.sc_category ?? 'general',
    tags: ext.sc_tags ? JSON.parse(ext.sc_tags) : [],
    is_movable: ext.sc_is_movable !== 'false',
    priority: ext.sc_priority ? parseInt(ext.sc_priority, 10) : 3,
    colorId: g.colorId,
    attendees: g.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
    })),
    reminders: g.reminders,
    recurrence: g.recurrence,
  };
}

function eventToGcal(e: Partial<Event>): Partial<GoogleCalendarEvent> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const result: Partial<GoogleCalendarEvent> = {};

  if (e.title !== undefined) result.summary = e.title;
  if (e.description !== undefined) result.description = e.description;
  if (e.location !== undefined) result.location = e.location;
  if (e.start !== undefined) result.start = { dateTime: toRFC3339(e.start), timeZone: tz };
  if (e.end !== undefined) result.end = { dateTime: toRFC3339(e.end), timeZone: tz };
  if (e.colorId !== undefined) result.colorId = e.colorId;
  if (e.attendees !== undefined) {
    result.attendees = e.attendees.map(a => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
    }));
  }
  if (e.reminders !== undefined) result.reminders = e.reminders;
  if (e.recurrence !== undefined) result.recurrence = e.recurrence;

  // Store SmartCalendar-specific fields in extendedProperties
  const priv: Record<string, string> = {};
  if (e.category !== undefined) priv.sc_category = e.category;
  if (e.tags !== undefined) priv.sc_tags = JSON.stringify(e.tags);
  if (e.is_movable !== undefined) priv.sc_is_movable = String(e.is_movable);
  if (e.priority !== undefined) priv.sc_priority = String(e.priority);

  if (Object.keys(priv).length > 0) {
    result.extendedProperties = { private: priv };
  }

  return result;
}

function toRFC3339(dateStr: string): string {
  if (dateStr.includes('T') && (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr))) {
    return dateStr;
  }
  if (dateStr.includes('T')) {
    return dateStr + getTimezoneOffsetString();
  }
  return dateStr + 'T00:00:00' + getTimezoneOffsetString();
}

function getTimezoneOffsetString(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function stripTZ(dateTimeStr: string): string {
  return dateTimeStr.replace(/[Z]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
}

// ── GoogleCalendar class ──

export class GoogleCalendar implements ICalendarBase {
  lastChangeSetId: string | null = null;
  private calendarId: string = PRIMARY;

  setCalendarId(id: string) {
    this.calendarId = id;
  }

  async getEvents(
    startDate: string,
    endDate: string,
    category?: string,
    tags?: string[],
  ): Promise<Event[]> {
    const items = await gcal.listEvents(this.calendarId, startDate, endDate);
    let events = items
      .filter(g => g.status !== 'cancelled')
      .map(gcalToEvent);

    // Strip timezone info from start/end for consistent local comparison
    events = events.map(e => ({
      ...e,
      start: stripTZ(e.start),
      end: stripTZ(e.end),
    }));

    if (category) {
      events = events.filter(e => e.category === category);
    }
    if (tags && tags.length > 0) {
      events = events.filter(e => tags.some(tag => e.tags.includes(tag)));
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return events;
  }

  async searchEvents(
    query: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Event[]> {
    const timeMin = startDate ?? '2020-01-01';
    const timeMax = endDate ?? '2030-12-31';
    const items = await gcal.listEvents(this.calendarId, timeMin, timeMax, 100, query);
    return items
      .filter(g => g.status !== 'cancelled')
      .map(gcalToEvent)
      .map(e => ({ ...e, start: stripTZ(e.start), end: stripTZ(e.end) }));
  }

  async getEventById(eventId: string): Promise<Event | undefined> {
    try {
      const g = await gcal.getEvent(this.calendarId, eventId);
      if (g.status === 'cancelled') return undefined;
      const e = gcalToEvent(g);
      return { ...e, start: stripTZ(e.start), end: stripTZ(e.end) };
    } catch {
      return undefined;
    }
  }

  async createEvent(event: Event): Promise<Event> {
    const gcalEvent = eventToGcal(event);
    const created = await gcal.createEvent(this.calendarId, gcalEvent);
    this.lastChangeSetId = created.id;
    const result = gcalToEvent(created);
    return { ...result, start: stripTZ(result.start), end: stripTZ(result.end) };
  }

  async updateEvent(
    eventId: string,
    changes: Partial<Event>,
  ): Promise<Event | undefined> {
    try {
      const existing = await gcal.getEvent(this.calendarId, eventId);
      if (!existing || existing.status === 'cancelled') return undefined;

      const gcalChanges = eventToGcal(changes);

      // Merge extendedProperties if they exist in both
      if (gcalChanges.extendedProperties?.private && existing.extendedProperties?.private) {
        gcalChanges.extendedProperties.private = {
          ...existing.extendedProperties.private,
          ...gcalChanges.extendedProperties.private,
        };
      }

      const updated = await gcal.updateEvent(this.calendarId, eventId, gcalChanges);
      this.lastChangeSetId = updated.id;
      const result = gcalToEvent(updated);
      return { ...result, start: stripTZ(result.start), end: stripTZ(result.end) };
    } catch {
      return undefined;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await gcal.deleteEvent(this.calendarId, eventId);
      this.lastChangeSetId = eventId;
      return true;
    } catch {
      return false;
    }
  }

  async getAllEvents(): Promise<Event[]> {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    return this.getEvents(
      oneYearAgo.toISOString().split('T')[0]!,
      oneYearFromNow.toISOString().split('T')[0]!,
    );
  }

  async undo(_changeSetId: string): Promise<boolean> {
    // Google Calendar doesn't support undo natively.
    // For create: we can delete the event (changeSetId = eventId).
    // For update/delete: not straightforward without a separate undo log.
    // For now, we attempt to delete the event (covers undo of create).
    try {
      await gcal.deleteEvent(this.calendarId, _changeSetId);
      return true;
    } catch {
      return false;
    }
  }
}
