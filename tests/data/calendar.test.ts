import { describe, it, expect, beforeEach } from 'vitest';
import { DexieCalendar } from '../../src/data/calendar';
import type { Event } from '../../src/shared/types';

describe('DexieCalendar', () => {
  let calendar: DexieCalendar;

  beforeEach(() => {
    calendar = new DexieCalendar();
  });

  function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
      id: '',
      title: 'Test Event',
      start: '2026-02-16T10:00:00',
      end: '2026-02-16T11:00:00',
      category: 'general',
      tags: [],
      is_movable: true,
      priority: 3,
      ...overrides,
    };
  }

  describe('createEvent', () => {
    it('should create an event and assign an ID', async () => {
      const event = makeEvent();
      const created = await calendar.createEvent(event);
      expect(created.id).toBeTruthy();
      expect(created.title).toBe('Test Event');
    });

    it('should record a change_set_id', async () => {
      await calendar.createEvent(makeEvent());
      expect(calendar.lastChangeSetId).toBeTruthy();
    });
  });

  describe('getEvents', () => {
    it('should return events within date range', async () => {
      await calendar.createEvent(makeEvent({ title: 'A' }));
      await calendar.createEvent(makeEvent({
        title: 'B',
        start: '2026-02-17T10:00:00',
        end: '2026-02-17T11:00:00',
      }));

      const events = await calendar.getEvents('2026-02-16T00:00:00', '2026-02-16T23:59:59');
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('A');
    });

    it('should filter by category', async () => {
      await calendar.createEvent(makeEvent({ title: 'Meeting', category: 'meeting' }));
      await calendar.createEvent(makeEvent({ title: 'General' }));

      const events = await calendar.getEvents('2026-02-16T00:00:00', '2026-02-16T23:59:59', 'meeting');
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('Meeting');
    });

    it('should filter by tags', async () => {
      await calendar.createEvent(makeEvent({ title: 'Tagged', tags: ['important'] }));
      await calendar.createEvent(makeEvent({ title: 'Untagged' }));

      const events = await calendar.getEvents('2026-02-16T00:00:00', '2026-02-16T23:59:59', undefined, ['important']);
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('Tagged');
    });
  });

  describe('searchEvents', () => {
    it('should search by title', async () => {
      await calendar.createEvent(makeEvent({ title: '팀 회의' }));
      await calendar.createEvent(makeEvent({ title: '점심' }));

      const results = await calendar.searchEvents('회의');
      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('팀 회의');
    });

    it('should search by description', async () => {
      await calendar.createEvent(makeEvent({ title: 'Event', description: '중요한 미팅' }));

      const results = await calendar.searchEvents('미팅');
      expect(results).toHaveLength(1);
    });
  });

  describe('updateEvent', () => {
    it('should update event fields', async () => {
      const created = await calendar.createEvent(makeEvent({ title: 'Original' }));
      const updated = await calendar.updateEvent(created.id, { title: 'Updated' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated');
    });

    it('should not update non-existent event', async () => {
      const result = await calendar.updateEvent('nonexistent', { title: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteEvent', () => {
    it('should delete an existing event', async () => {
      const created = await calendar.createEvent(makeEvent());
      const deleted = await calendar.deleteEvent(created.id);
      expect(deleted).toBe(true);

      const found = await calendar.getEventById(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent event', async () => {
      const deleted = await calendar.deleteEvent('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('undo', () => {
    it('should undo create (delete the created event)', async () => {
      const created = await calendar.createEvent(makeEvent());
      const changeSetId = calendar.lastChangeSetId!;

      const result = await calendar.undo(changeSetId);
      expect(result).toBe(true);

      const found = await calendar.getEventById(created.id);
      expect(found).toBeUndefined();
    });

    it('should undo delete (restore the deleted event)', async () => {
      const created = await calendar.createEvent(makeEvent({ title: 'Restore Me' }));
      await calendar.deleteEvent(created.id);
      const changeSetId = calendar.lastChangeSetId!;

      const result = await calendar.undo(changeSetId);
      expect(result).toBe(true);

      const found = await calendar.getEventById(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Restore Me');
    });

    it('should undo update (restore previous state)', async () => {
      const created = await calendar.createEvent(makeEvent({ title: 'Before' }));
      await calendar.updateEvent(created.id, { title: 'After' });
      const changeSetId = calendar.lastChangeSetId!;

      const result = await calendar.undo(changeSetId);
      expect(result).toBe(true);

      const found = await calendar.getEventById(created.id);
      expect(found!.title).toBe('Before');
    });

    it('should return false for unknown change_set_id', async () => {
      const result = await calendar.undo('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAllEvents', () => {
    it('should return all events sorted by start', async () => {
      await calendar.createEvent(makeEvent({
        title: 'Later',
        start: '2026-02-17T10:00:00',
        end: '2026-02-17T11:00:00',
      }));
      await calendar.createEvent(makeEvent({
        title: 'Earlier',
        start: '2026-02-16T10:00:00',
        end: '2026-02-16T11:00:00',
      }));

      const all = await calendar.getAllEvents();
      expect(all).toHaveLength(2);
      expect(all[0]!.title).toBe('Earlier');
      expect(all[1]!.title).toBe('Later');
    });
  });
});
