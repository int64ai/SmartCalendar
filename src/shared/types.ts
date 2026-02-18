/** Data model type definitions (ported from models.py) */

export enum Category {
  DAX_WEB = 'dax-web',
  DAX_SL = 'dax-sl',
  ETC = 'etc',
  MEETING = 'meeting',
  AI = 'ai',
  GENERAL = 'general',
}

export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
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
  /** Google Calendar colorId (1~11) */
  colorId?: string;
  /** Attendees list */
  attendees?: EventAttendee[];
  /** Reminders configuration */
  reminders?: { useDefault: boolean; overrides?: EventReminder[] };
  /** RRULE recurrence strings (e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO"]) */
  recurrence?: string[];
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

// ── User Persona ──

export type SchedulingStyle = 'conservative' | 'moderate' | 'aggressive';

export interface RoutinePattern {
  keyword: string;
  /** 0=Sun … 6=Sat. Empty array means every day. */
  dayOfWeek: number[];
  /** HH:MM */
  typicalStart: string;
  /** HH:MM */
  typicalEnd: string;
  /** 0–1, frequency-based */
  confidence: number;
}

export interface WeekdayProfile {
  avgEvents: number;
  busyHours: string[];
  freeHours: string[];
}

export interface PersonaNote {
  createdAt: string;
  type: 'drift' | 'explicit';
  content: string;
  relatedRoutine?: string;
  count: number;
}

export interface UserPersona {
  version: 1;
  createdAt: string;
  updatedAt: string;

  activeHours: {
    workStart: string;
    workEnd: string;
    lunchStart: string;
    lunchEnd: string;
  };
  routines: RoutinePattern[];
  weekdayProfile: Record<string, WeekdayProfile>;

  schedulingStyle: SchedulingStyle;
  preferredMeetingTimes: string[];
  avgDailyEvents: number;
  bufferPreference: number;

  notes: PersonaNote[];
}
