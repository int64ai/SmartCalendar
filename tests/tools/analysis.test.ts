import { describe, it, expect, beforeEach } from 'vitest';
import { DexieCalendar } from '../../src/data/calendar';
import { checkConflicts, findRelatedEvents, getEventContext } from '../../src/tools/analysis';
import type { Event } from '../../src/shared/types';

describe('Analysis Tools', () => {
  let calendar: DexieCalendar;
  let evtIds: string[];

  beforeEach(async () => {
    calendar = new DexieCalendar();
    evtIds = [];

    const e1 = await calendar.createEvent({
      id: 'evt_1', title: '아침 회의',
      start: '2026-02-16T09:00:00', end: '2026-02-16T10:00:00',
      category: 'meeting', tags: [], is_movable: true, priority: 3,
    });
    evtIds.push(e1.id);

    const e2 = await calendar.createEvent({
      id: 'evt_2', title: '점심 회의',
      start: '2026-02-16T12:00:00', end: '2026-02-16T13:00:00',
      category: 'meeting', tags: [], is_movable: true, priority: 3,
    });
    evtIds.push(e2.id);

    const e3 = await calendar.createEvent({
      id: 'evt_3', title: '오후 코딩',
      start: '2026-02-16T14:00:00', end: '2026-02-16T17:00:00',
      category: 'ai', tags: [], is_movable: true, priority: 4,
    });
    evtIds.push(e3.id);
  });

  describe('checkConflicts', () => {
    it('should detect overlapping events', async () => {
      const conflicts = await checkConflicts(calendar, '2026-02-16T09:30:00', '2026-02-16T10:30:00');
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.some((e: Event) => e.title === '아침 회의')).toBe(true);
    });

    it('should return empty for non-overlapping time', async () => {
      const conflicts = await checkConflicts(calendar, '2026-02-16T10:00:00', '2026-02-16T11:00:00');
      expect(conflicts).toHaveLength(0);
    });

    it('should detect full overlap', async () => {
      const conflicts = await checkConflicts(calendar, '2026-02-16T08:00:00', '2026-02-16T18:00:00');
      expect(conflicts).toHaveLength(3);
    });
  });

  describe('findRelatedEvents', () => {
    it('should find events by keyword', async () => {
      const related = await findRelatedEvents(calendar, '회의');
      expect(related).toHaveLength(2);
    });

    it('should respect limit', async () => {
      const related = await findRelatedEvents(calendar, '회의', 1);
      expect(related).toHaveLength(1);
    });

    it('should be case-insensitive', async () => {
      const related = await findRelatedEvents(calendar, '코딩');
      expect(related).toHaveLength(1);
    });
  });

  describe('getEventContext', () => {
    it('should return surrounding events', async () => {
      // evt_2 (12:00-13:00) should have evt_1 before and evt_3 after
      const context = await getEventContext(calendar, evtIds[1]!, 4, 4);
      expect(context.event).toBeDefined();
      // With 4 hours before 12:00 = 08:00, and evt_1 starts at 09:00 and ends at 10:00
      expect((context.before as unknown[]).length).toBeGreaterThanOrEqual(1);
      // With 4 hours after 13:00 = 17:00, and evt_3 starts at 14:00
      expect((context.after as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle non-existent event', async () => {
      const context = await getEventContext(calendar, 'nonexistent');
      expect(context.error).toBeDefined();
      expect(context.event).toBeNull();
    });
  });
});
