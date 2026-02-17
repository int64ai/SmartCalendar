/** Dexie-based calendar implementation (ported from db_calendar.py) */

import { v4 as uuidv4 } from 'uuid';
import { db } from './database';
import type { ICalendarBase } from './calendar-base';
import type { Event, UndoLog } from '../shared/types';
import { Category } from '../shared/types';

export class DexieCalendar implements ICalendarBase {
  lastChangeSetId: string | null = null;

  private recordUndo(
    changeSetId: string,
    snapshots: Array<{ event_id: string; before: Event | null }>,
  ): UndoLog {
    return {
      undoId: uuidv4(),
      changeSetId,
      createdAt: new Date().toISOString(),
      snapshots,
    };
  }

  async getEvents(
    startDate: string,
    endDate: string,
    category?: string,
    tags?: string[],
  ): Promise<Event[]> {
    let events = await db.events
      .where('start')
      .belowOrEqual(endDate)
      .and((e) => e.end >= startDate)
      .sortBy('start');

    if (category) {
      events = events.filter((e) => e.category === category);
    }

    if (tags && tags.length > 0) {
      events = events.filter((e) =>
        tags.some((tag) => e.tags.includes(tag)),
      );
    }

    return events;
  }

  async searchEvents(
    query: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Event[]> {
    const pattern = query.toLowerCase();

    let events = await db.events.orderBy('start').toArray();

    events = events.filter((e) => {
      const titleMatch = e.title.toLowerCase().includes(pattern);
      const descMatch = e.description
        ? e.description.toLowerCase().includes(pattern)
        : false;
      const tagMatch = e.tags.some((t) =>
        t.toLowerCase().includes(pattern),
      );
      return titleMatch || descMatch || tagMatch;
    });

    if (startDate) {
      events = events.filter((e) => e.end >= startDate);
    }
    if (endDate) {
      events = events.filter((e) => e.start <= endDate);
    }

    return events;
  }

  async getEventById(eventId: string): Promise<Event | undefined> {
    return db.events.get(eventId);
  }

  async createEvent(event: Event): Promise<Event> {
    const id = event.id || `evt_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    const newEvent: Event = { ...event, id };
    const changeSetId = uuidv4();
    const undoLog = this.recordUndo(changeSetId, [
      { event_id: id, before: null },
    ]);

    await db.transaction('rw', db.events, db.undoLogs, async () => {
      await db.events.add(newEvent);
      await db.undoLogs.add(undoLog);
    });

    this.lastChangeSetId = changeSetId;
    return newEvent;
  }

  async updateEvent(
    eventId: string,
    changes: Partial<Event>,
  ): Promise<Event | undefined> {
    const changeSetId = uuidv4();
    let updated: Event | undefined;

    await db.transaction('rw', db.events, db.undoLogs, async () => {
      const existing = await db.events.get(eventId);
      if (!existing) return;

      const beforeSnapshot = { ...existing };

      // Build update, skipping id changes
      const updateFields: Partial<Event> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'id') continue;
        if (key === 'category' && typeof value === 'string') {
          try {
            // Validate category
            updateFields.category =
              Object.values(Category).includes(value as Category)
                ? value
                : existing.category;
          } catch {
            updateFields.category = existing.category;
          }
        } else {
          (updateFields as Record<string, unknown>)[key] = value;
        }
      }

      await db.events.update(eventId, updateFields);
      const undoLog = this.recordUndo(changeSetId, [
        { event_id: eventId, before: beforeSnapshot },
      ]);
      await db.undoLogs.add(undoLog);

      updated = await db.events.get(eventId);
    });

    if (updated) {
      this.lastChangeSetId = changeSetId;
    }
    return updated;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    const changeSetId = uuidv4();
    let deleted = false;

    await db.transaction('rw', db.events, db.undoLogs, async () => {
      const existing = await db.events.get(eventId);
      if (!existing) return;

      const beforeSnapshot = { ...existing };
      await db.events.delete(eventId);

      const undoLog = this.recordUndo(changeSetId, [
        { event_id: eventId, before: beforeSnapshot },
      ]);
      await db.undoLogs.add(undoLog);
      deleted = true;
    });

    if (deleted) {
      this.lastChangeSetId = changeSetId;
    }
    return deleted;
  }

  async getAllEvents(): Promise<Event[]> {
    return db.events.orderBy('start').toArray();
  }

  async undo(changeSetId: string): Promise<boolean> {
    const logs = await db.undoLogs
      .where('changeSetId')
      .equals(changeSetId)
      .toArray();

    if (logs.length === 0) return false;

    await db.transaction('rw', db.events, db.undoLogs, async () => {
      for (const log of logs) {
        for (const snapshot of log.snapshots) {
          const eventId = snapshot.event_id;
          const before = snapshot.before;
          const existing = await db.events.get(eventId);

          if (before === null) {
            // Undo create -> delete
            if (existing) {
              await db.events.delete(eventId);
            }
          } else if (!existing) {
            // Undo delete -> re-create
            await db.events.add(before);
          } else {
            // Undo update -> restore before state
            const restore: Partial<Event> = {};
            for (const [key, value] of Object.entries(before)) {
              if (key === 'id') continue;
              (restore as Record<string, unknown>)[key] = value;
            }
            await db.events.update(eventId, restore);
          }
        }
      }
    });

    return true;
  }
}
