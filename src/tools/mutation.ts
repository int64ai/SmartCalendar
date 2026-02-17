/** Mutation tools (ported from mutation.py) */

import type { DexieCalendar } from '../data/calendar';
import type { Event } from '../shared/types';
import { Category } from '../shared/types';

export async function createEvent(
  calendar: DexieCalendar,
  title: string,
  start: string,
  end: string,
  category: string = 'general',
  tags?: string[],
  description?: string,
  location?: string,
  is_movable: boolean = true,
  priority: number = 3,
): Promise<Record<string, unknown>> {
  try {
    // Validate category
    if (!Object.values(Category).includes(category as Category)) {
      return {
        success: false,
        error: `유효하지 않은 카테고리: ${category}. 가능한 값: ${Object.values(Category).join(', ')}`,
      };
    }

    const event: Event = {
      id: '',
      title,
      start,
      end,
      description,
      location,
      category,
      tags: tags ?? [],
      is_movable,
      priority,
    };

    const created = await calendar.createEvent(event);

    const result: Record<string, unknown> = {
      success: true,
      message: `일정 '${title}'이(가) 생성되었습니다.`,
      event: created,
    };
    if (calendar.lastChangeSetId) {
      result.change_set_id = calendar.lastChangeSetId;
    }
    return result;
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function updateEvent(
  calendar: DexieCalendar,
  eventId: string,
  changes: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const existing = await calendar.getEventById(eventId);
    if (!existing) {
      return {
        success: false,
        error: `일정을 찾을 수 없습니다: ${eventId}`,
      };
    }

    // Validate category if present
    if ('category' in changes) {
      if (
        !Object.values(Category).includes(changes.category as Category)
      ) {
        return {
          success: false,
          error: `유효하지 않은 카테고리: ${changes.category}`,
        };
      }
    }

    const updated = await calendar.updateEvent(
      eventId,
      changes as Partial<Event>,
    );

    if (updated) {
      const result: Record<string, unknown> = {
        success: true,
        message: `일정 '${updated.title}'이(가) 수정되었습니다.`,
        event: updated,
        changes,
      };
      if (calendar.lastChangeSetId) {
        result.change_set_id = calendar.lastChangeSetId;
      }
      return result;
    }

    return {
      success: false,
      error: '일정 수정에 실패했습니다.',
    };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function deleteEvent(
  calendar: DexieCalendar,
  eventId: string,
): Promise<Record<string, unknown>> {
  try {
    const existing = await calendar.getEventById(eventId);
    if (!existing) {
      return {
        success: false,
        error: `일정을 찾을 수 없습니다: ${eventId}`,
      };
    }

    const deletedInfo = { id: existing.id, title: existing.title };

    const result = await calendar.deleteEvent(eventId);

    if (result) {
      const response: Record<string, unknown> = {
        success: true,
        message: `일정 '${deletedInfo.title}'이(가) 삭제되었습니다.`,
        deleted_event: deletedInfo,
      };
      if (calendar.lastChangeSetId) {
        response.change_set_id = calendar.lastChangeSetId;
      }
      return response;
    }

    return {
      success: false,
      error: '일정 삭제에 실패했습니다.',
    };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
