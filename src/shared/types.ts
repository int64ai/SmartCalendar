/** Data model type definitions (ported from models.py) */

export enum Category {
  DAX_WEB = 'dax-web',
  DAX_SL = 'dax-sl',
  ETC = 'etc',
  MEETING = 'meeting',
  AI = 'ai',
  GENERAL = 'general',
}

export interface Event {
  id: string;
  title: string;
  /** ISO 8601 string */
  start: string;
  /** ISO 8601 string */
  end: string;
  description?: string;
  location?: string;
  category: string;
  tags: string[];
  is_movable: boolean;
  priority: number;
  recurrence?: Record<string, unknown>;
}

export interface UndoLog {
  undoId: string;
  changeSetId: string;
  /** ISO 8601 string */
  createdAt: string;
  snapshots: Array<{ event_id: string; before: Event | null }>;
}

export interface TimeSlot {
  /** ISO 8601 string */
  start: string;
  /** ISO 8601 string */
  end: string;
}

export interface ScheduleProposal {
  action: string;
  event_id?: string;
  original?: { start: string; end: string | null };
  proposed?: { start: string; end: string | null };
  reason: string;
}
