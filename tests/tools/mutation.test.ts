import { describe, it, expect, beforeEach } from 'vitest';
import { DexieCalendar } from '../../src/data/calendar';
import { createEvent, updateEvent, deleteEvent } from '../../src/tools/mutation';

describe('Mutation Tools', () => {
  let calendar: DexieCalendar;

  beforeEach(() => {
    calendar = new DexieCalendar();
  });

  describe('createEvent', () => {
    it('should create an event successfully', async () => {
      const result = await createEvent(
        calendar, '테스트 회의',
        '2026-02-16T10:00:00', '2026-02-16T11:00:00',
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('테스트 회의');
      expect(result.event).toBeDefined();
      expect(result.change_set_id).toBeTruthy();
    });

    it('should reject invalid category', async () => {
      const result = await createEvent(
        calendar, 'Test',
        '2026-02-16T10:00:00', '2026-02-16T11:00:00',
        'invalid_category',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 카테고리');
    });

    it('should use correct category', async () => {
      const result = await createEvent(
        calendar, 'AI Task',
        '2026-02-16T10:00:00', '2026-02-16T11:00:00',
        'ai', ['deep-learning'],
      );
      expect(result.success).toBe(true);
      const event = result.event as { category: string; tags: string[] };
      expect(event.category).toBe('ai');
      expect(event.tags).toContain('deep-learning');
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
      const created = await createEvent(
        calendar, 'Original',
        '2026-02-16T10:00:00', '2026-02-16T11:00:00',
      );
      const eventId = (created.event as { id: string }).id;

      const result = await updateEvent(calendar, eventId, { title: 'Updated' });
      expect(result.success).toBe(true);
      expect((result.event as { title: string }).title).toBe('Updated');
    });

    it('should fail for non-existent event', async () => {
      const result = await updateEvent(calendar, 'nonexistent', { title: 'X' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없습니다');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an existing event', async () => {
      const created = await createEvent(
        calendar, 'To Delete',
        '2026-02-16T10:00:00', '2026-02-16T11:00:00',
      );
      const eventId = (created.event as { id: string }).id;

      const result = await deleteEvent(calendar, eventId);
      expect(result.success).toBe(true);
      expect(result.change_set_id).toBeTruthy();
    });

    it('should fail for non-existent event', async () => {
      const result = await deleteEvent(calendar, 'nonexistent');
      expect(result.success).toBe(false);
    });
  });
});
