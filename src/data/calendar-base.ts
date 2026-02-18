/** Calendar abstract interface (ported from base.py) */

import type { Event } from '../shared/types';

export interface ICalendarBase {
  lastChangeSetId: string | null;

  getEvents(
    startDate: string,
    endDate: string,
    category?: string,
    tags?: string[],
  ): Promise<Event[]>;

  searchEvents(
    query: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Event[]>;

  getEventById(eventId: string): Promise<Event | undefined>;

  createEvent(event: Event): Promise<Event>;

  updateEvent(
    eventId: string,
    changes: Partial<Event>,
  ): Promise<Event | undefined>;

  deleteEvent(eventId: string): Promise<boolean>;

  getAllEvents(): Promise<Event[]>;

  undo(changeSetId: string): Promise<boolean>;
}
