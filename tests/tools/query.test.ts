import { describe, it, expect, beforeEach } from 'vitest';
import { DexieCalendar } from '../../src/data/calendar';
import { getEvents, searchEvents, getFreeSlots } from '../../src/tools/query';

describe('Query Tools', () => {
  let calendar: DexieCalendar;

  beforeEach(async () => {
    calendar = new DexieCalendar();
    // Seed some events
    await calendar.createEvent({
      id: '', title: '아침 회의',
      start: '2026-02-16T09:00:00', end: '2026-02-16T10:00:00',
      category: 'meeting', tags: ['work'], is_movable: true, priority: 3,
    });
    await calendar.createEvent({
      id: '', title: '점심',
      start: '2026-02-16T12:00:00', end: '2026-02-16T13:00:00',
      category: 'general', tags: [], is_movable: true, priority: 2,
    });
    await calendar.createEvent({
      id: '', title: '오후 코딩',
      start: '2026-02-16T14:00:00', end: '2026-02-16T17:00:00',
      category: 'ai', tags: ['dev'], is_movable: true, priority: 4,
    });
  });

  describe('getEvents', () => {
    it('should return events for a date range', async () => {
      const events = await getEvents(calendar, '2026-02-16', '2026-02-16');
      expect(events).toHaveLength(3);
    });

    it('should filter by category', async () => {
      const events = await getEvents(calendar, '2026-02-16', '2026-02-16', 'meeting');
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('아침 회의');
    });
  });

  describe('searchEvents', () => {
    it('should find events by keyword', async () => {
      const results = await searchEvents(calendar, '회의');
      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('아침 회의');
    });

    it('should search tags', async () => {
      const results = await searchEvents(calendar, 'dev');
      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('오후 코딩');
    });
  });

  describe('getFreeSlots', () => {
    it('should find free time slots', async () => {
      const slots = await getFreeSlots(calendar, '2026-02-16', 30);
      expect(slots.length).toBeGreaterThan(0);

      // Verify slots are between events
      for (const slot of slots) {
        const slotDuration = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000;
        expect(slotDuration).toBeGreaterThanOrEqual(30);
      }
    });

    it('should respect custom time range', async () => {
      const slots = await getFreeSlots(calendar, '2026-02-16', 30, ['10:00', '12:00']);
      // Between 10:00 and 12:00, there should be a free slot (10:00-12:00)
      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        expect(new Date(slot.start).getHours()).toBeGreaterThanOrEqual(10);
      }
    });
  });
});
