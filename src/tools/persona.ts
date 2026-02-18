/** User persona analysis, update, and drift detection */

import type { ICalendarBase } from '../data/calendar-base';
import type { Event, UserPersona, RoutinePattern, WeekdayProfile, SchedulingStyle } from '../shared/types';
import { getPersona, setPersona } from '../shared/storage';
import { toLocalISO } from './date-utils';

const ANALYSIS_WEEKS = 10;
const MAX_NOTES = 50;
const DRIFT_THRESHOLD_MINUTES = 30;
const DRIFT_ADOPT_COUNT = 3;

const LUNCH_KEYWORDS = ['점심', 'lunch', '런치', '식사'];
const MEETING_KEYWORDS = ['회의', 'meeting', '미팅', 'sync', 'standup', '스탠드업', '데일리', 'daily'];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// Simple async mutex for detectDrift to prevent concurrent read-modify-write
let driftLock: Promise<void> = Promise.resolve();

// ── Helpers ──

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

function minutesToHHMM(mins: number): string {
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function titleMatchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/** Returns true if the event spans a full day (start 00:00, end 23:59 or 00:00 next day) */
function isAllDayEvent(ev: Event): boolean {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const sMin = s.getHours() * 60 + s.getMinutes();
  const eMin = e.getHours() * 60 + e.getMinutes();
  // 00:00-00:00 or 00:00-23:59 patterns
  if (sMin !== 0) return false;
  if (eMin === 0 || eMin === 1439) return true;
  // Multi-day: end is on a different date at 00:00
  const dayDiff = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  return dayDiff >= 23;
}

// ── Core analysis ──

export async function analyzeUserPatterns(
  calendar: ICalendarBase,
): Promise<{ persona: UserPersona; summary: string }> {
  const now = new Date();
  const rangeEnd = new Date(now);
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - ANALYSIS_WEEKS * 7);

  const allEvents = await calendar.getEvents(toLocalISO(rangeStart), toLocalISO(rangeEnd));
  const events = allEvents.filter((ev) => !isAllDayEvent(ev));

  if (events.length === 0) {
    throw new Error('분석할 일정이 없습니다. 최근 일정이 있어야 패턴을 파악할 수 있습니다.');
  }

  const activeHours = extractActiveHours(events);
  const routines = extractRoutines(events);
  const weekdayProfile = extractWeekdayProfile(events);
  const { avgDailyEvents, bufferPreference, schedulingStyle } = extractSchedulingMetrics(events);
  const preferredMeetingTimes = extractPreferredMeetingTimes(events);

  const persona: UserPersona = {
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    activeHours,
    routines,
    weekdayProfile,
    schedulingStyle,
    preferredMeetingTimes,
    avgDailyEvents,
    bufferPreference,
    notes: [],
  };

  await setPersona(persona);

  const summary = buildSummary(persona, events.length);
  return { persona, summary };
}

// ── Extract active hours ──

function extractActiveHours(events: Event[]) {
  const startMinutes: number[] = [];
  const endMinutes: number[] = [];
  const lunchStartMinutes: number[] = [];
  const lunchEndMinutes: number[] = [];

  for (const ev of events) {
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = e.getHours() * 60 + e.getMinutes();

    startMinutes.push(sMin);
    endMinutes.push(eMin);

    if (titleMatchesKeywords(ev.title, LUNCH_KEYWORDS)) {
      lunchStartMinutes.push(sMin);
      lunchEndMinutes.push(eMin);
    }
  }

  startMinutes.sort((a, b) => a - b);
  endMinutes.sort((a, b) => a - b);
  lunchStartMinutes.sort((a, b) => a - b);
  lunchEndMinutes.sort((a, b) => a - b);

  const p10 = Math.floor(startMinutes.length * 0.1);
  const p90 = Math.floor(endMinutes.length * 0.9);

  const workStartMin = startMinutes.length > 0 ? startMinutes[Math.max(0, p10)]! : 540;
  const workEndMin = endMinutes.length > 0 ? endMinutes[Math.min(endMinutes.length - 1, p90)]! : 1080;

  const lunchStart = lunchStartMinutes.length >= 3
    ? median(lunchStartMinutes)
    : 750;
  const lunchEnd = lunchEndMinutes.length >= 3
    ? median(lunchEndMinutes)
    : 810;

  return {
    workStart: minutesToHHMM(workStartMin),
    workEnd: minutesToHHMM(workEndMin),
    lunchStart: minutesToHHMM(lunchStart),
    lunchEnd: minutesToHHMM(lunchEnd),
  };
}

// ── Extract routines (recurring keyword+time clusters) ──

function extractRoutines(events: Event[]): RoutinePattern[] {
  const clusters = new Map<string, { dayOfWeek: Map<number, number>; starts: number[]; ends: number[]; total: number }>();
  const allKeywords = [...LUNCH_KEYWORDS, ...MEETING_KEYWORDS];

  for (const ev of events) {
    const lower = ev.title.toLowerCase();
    for (const kw of allKeywords) {
      if (!lower.includes(kw)) continue;
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();

      let cluster = clusters.get(kw);
      if (!cluster) {
        cluster = { dayOfWeek: new Map(), starts: [], ends: [], total: 0 };
        clusters.set(kw, cluster);
      }
      cluster.total++;
      cluster.starts.push(sMin);
      cluster.ends.push(eMin);
      const dow = s.getDay();
      cluster.dayOfWeek.set(dow, (cluster.dayOfWeek.get(dow) ?? 0) + 1);
      break;
    }
  }

  // Also detect custom recurring patterns by exact title
  const titleCounts = new Map<string, { starts: number[]; ends: number[]; dayOfWeek: Map<number, number>; total: number }>();
  for (const ev of events) {
    const key = ev.title.trim().toLowerCase();
    if (allKeywords.some((kw) => key.includes(kw))) continue;
    const s = new Date(ev.start);
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = new Date(ev.end).getHours() * 60 + new Date(ev.end).getMinutes();

    let entry = titleCounts.get(key);
    if (!entry) {
      entry = { starts: [], ends: [], dayOfWeek: new Map(), total: 0 };
      titleCounts.set(key, entry);
    }
    entry.total++;
    entry.starts.push(sMin);
    entry.ends.push(eMin);
    const dow = s.getDay();
    entry.dayOfWeek.set(dow, (entry.dayOfWeek.get(dow) ?? 0) + 1);
  }

  for (const [title, data] of titleCounts) {
    if (data.total < 4) continue;
    const sortedStarts = [...data.starts].sort((a, b) => a - b);
    const range = sortedStarts[sortedStarts.length - 1]! - sortedStarts[0]!;
    if (range <= 90) {
      clusters.set(title, data);
    }
  }

  const totalWeeks = ANALYSIS_WEEKS;
  const routines: RoutinePattern[] = [];

  for (const [keyword, data] of clusters) {
    if (data.total < 3) continue;
    const sortedStarts = [...data.starts].sort((a, b) => a - b);
    const sortedEnds = [...data.ends].sort((a, b) => a - b);

    const dayOfWeek: number[] = [];
    for (const [dow, count] of data.dayOfWeek) {
      if (count / data.total >= 0.3) dayOfWeek.push(dow);
    }
    dayOfWeek.sort((a, b) => a - b);

    const expectedPerWeek = dayOfWeek.length > 0 ? dayOfWeek.length : 5;
    const confidence = Math.min(1, data.total / (totalWeeks * expectedPerWeek));

    routines.push({
      keyword,
      dayOfWeek,
      typicalStart: minutesToHHMM(median(sortedStarts)),
      typicalEnd: minutesToHHMM(median(sortedEnds)),
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  routines.sort((a, b) => b.confidence - a.confidence);
  return routines.slice(0, 20);
}

// ── Extract weekday profiles ──

function extractWeekdayProfile(events: Event[]): Record<string, WeekdayProfile> {
  const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayBuckets = new Map<number, { counts: Map<string, number>; dates: Set<string> }>();

  for (let d = 0; d < 7; d++) {
    dayBuckets.set(d, { counts: new Map(), dates: new Set() });
  }

  for (const ev of events) {
    const s = new Date(ev.start);
    const dow = s.getDay();
    const dateKey = `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`;
    const hourKey = pad2(s.getHours());

    const bucket = dayBuckets.get(dow)!;
    bucket.dates.add(dateKey);
    bucket.counts.set(hourKey, (bucket.counts.get(hourKey) ?? 0) + 1);
  }

  const profile: Record<string, WeekdayProfile> = {};

  for (const [dow, bucket] of dayBuckets) {
    const numWeeks = Math.max(1, bucket.dates.size);
    let totalEvents = 0;
    for (const c of bucket.counts.values()) totalEvents += c;

    const busyHours: string[] = [];
    const freeHours: string[] = [];

    for (let h = 8; h <= 19; h++) {
      const hk = pad2(h);
      const count = bucket.counts.get(hk) ?? 0;
      if (count / numWeeks >= 0.5) {
        busyHours.push(`${hk}:00`);
      } else if (count / numWeeks <= 0.15) {
        freeHours.push(`${hk}:00`);
      }
    }

    profile[WEEKDAY_NAMES[dow]!] = {
      avgEvents: Math.round((totalEvents / numWeeks) * 10) / 10,
      busyHours,
      freeHours,
    };
  }

  return profile;
}

// ── Extract scheduling metrics ──

function extractSchedulingMetrics(events: Event[]) {
  const byDate = new Map<string, Event[]>();
  for (const ev of events) {
    const s = new Date(ev.start);
    const dateKey = `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`;
    const list = byDate.get(dateKey) ?? [];
    list.push(ev);
    byDate.set(dateKey, list);
  }

  const dailyCounts = [...byDate.values()].map((evs) => evs.length);
  const avgDailyEvents = dailyCounts.length > 0
    ? Math.round((dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) * 10) / 10
    : 0;

  const gaps: number[] = [];
  for (const evs of byDate.values()) {
    const sorted = [...evs].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1]!.end).getTime();
      const nextStart = new Date(sorted[i]!.start).getTime();
      const gapMin = (nextStart - prevEnd) / 60000;
      if (gapMin >= 0 && gapMin <= 120) gaps.push(gapMin);
    }
  }

  gaps.sort((a, b) => a - b);
  const bufferPreference = gaps.length > 0 ? Math.round(median(gaps)) : 15;

  let schedulingStyle: SchedulingStyle = 'moderate';
  if (avgDailyEvents >= 6 && bufferPreference <= 10) {
    schedulingStyle = 'aggressive';
  } else if (avgDailyEvents <= 3 || bufferPreference >= 30) {
    schedulingStyle = 'conservative';
  }

  return { avgDailyEvents, bufferPreference, schedulingStyle };
}

// ── Extract preferred meeting times ──

function extractPreferredMeetingTimes(events: Event[]): string[] {
  const meetingHours = new Map<string, number>();

  for (const ev of events) {
    if (!titleMatchesKeywords(ev.title, MEETING_KEYWORDS)) continue;
    const s = new Date(ev.start);
    const hk = `${pad2(s.getHours())}:00`;
    meetingHours.set(hk, (meetingHours.get(hk) ?? 0) + 1);
  }

  return [...meetingHours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hk]) => hk);
}

// ── Build human-readable summary ──

function buildSummary(persona: UserPersona, eventCount: number): string {
  const { activeHours, routines, schedulingStyle, avgDailyEvents, bufferPreference } = persona;

  const styleLabel: Record<SchedulingStyle, string> = {
    conservative: '보수적 (여유 있는 일정 선호)',
    moderate: '보통',
    aggressive: '공격적 (빽빽한 일정)',
  };

  let summary = `📊 ${eventCount}개 일정을 분석했습니다.\n\n`;
  summary += `⏰ 활동 시간: ${activeHours.workStart} ~ ${activeHours.workEnd}\n`;
  summary += `🍽️ 점심 시간: ${activeHours.lunchStart} ~ ${activeHours.lunchEnd}\n`;
  summary += `📅 일일 평균: ${avgDailyEvents}개 일정\n`;
  summary += `⏱️ 일정 간 평균 여유: ${bufferPreference}분\n`;
  summary += `📐 스케줄링 성향: ${styleLabel[schedulingStyle]}\n`;

  if (routines.length > 0) {
    summary += `\n🔄 발견된 루틴:\n`;
    for (const r of routines.slice(0, 5)) {
      const days = r.dayOfWeek.length > 0
        ? r.dayOfWeek.map((d) => WEEKDAY_LABELS[d]).join('·')
        : '매일';
      summary += `  • ${r.keyword}: ${days} ${r.typicalStart}~${r.typicalEnd} (신뢰도 ${Math.round(r.confidence * 100)}%)\n`;
    }
  }

  return summary;
}

// ── Update persona (partial patch) ──

export async function updatePersona(
  changes: {
    activeHours?: Partial<UserPersona['activeHours']>;
    schedulingStyle?: UserPersona['schedulingStyle'];
    bufferPreference?: number;
    routines?: UserPersona['routines'];
  },
  reason: string,
): Promise<UserPersona> {
  const current = await getPersona();
  if (!current) throw new Error('페르소나가 아직 설정되지 않았습니다. 먼저 "패턴 분석"을 실행해주세요.');

  const updated: UserPersona = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (changes.activeHours) {
    updated.activeHours = { ...current.activeHours, ...changes.activeHours };
  }
  if (changes.schedulingStyle) {
    updated.schedulingStyle = changes.schedulingStyle;
  }
  if (changes.bufferPreference !== undefined) {
    updated.bufferPreference = changes.bufferPreference;
  }
  if (changes.routines) {
    updated.routines = changes.routines;
  }

  updated.notes = [
    ...current.notes,
    {
      createdAt: new Date().toISOString(),
      type: 'explicit' as const,
      content: reason,
      count: 1,
    },
  ].slice(-MAX_NOTES);

  await setPersona(updated);
  return updated;
}

// ── Drift detection (called after event mutations) ──
// Uses a simple async mutex to prevent concurrent read-modify-write races.

export async function detectDrift(
  mutatedEvent: { title: string; start: string; end: string },
): Promise<void> {
  const prev = driftLock;
  let resolve: () => void;
  driftLock = new Promise<void>((r) => { resolve = r; });
  await prev;

  try {
    await detectDriftInner(mutatedEvent);
  } finally {
    resolve!();
  }
}

async function detectDriftInner(
  mutatedEvent: { title: string; start: string; end: string },
): Promise<void> {
  const persona = await getPersona();
  if (!persona) return;

  const evStart = new Date(mutatedEvent.start);
  const evEnd = new Date(mutatedEvent.end);
  const evStartMin = evStart.getHours() * 60 + evStart.getMinutes();
  const evEndMin = evEnd.getHours() * 60 + evEnd.getMinutes();

  let changed = false;

  for (const routine of persona.routines) {
    if (!titleMatchesKeywords(mutatedEvent.title, [routine.keyword])) continue;

    const routineStartMin = hhmmToMinutes(routine.typicalStart);
    const routineEndMin = hhmmToMinutes(routine.typicalEnd);
    const startDiff = Math.abs(evStartMin - routineStartMin);
    const endDiff = Math.abs(evEndMin - routineEndMin);

    if (startDiff < DRIFT_THRESHOLD_MINUTES && endDiff < DRIFT_THRESHOLD_MINUTES) continue;

    const noteContent = `"${routine.keyword}" 시간대 변화 감지: ${routine.typicalStart}→${toHHMM(evStart)}`;

    const existingIdx = persona.notes.findIndex(
      (n) => n.type === 'drift' && n.relatedRoutine === routine.keyword,
    );

    if (existingIdx >= 0) {
      const existing = persona.notes[existingIdx]!;
      existing.count++;
      existing.content = noteContent;
      existing.createdAt = new Date().toISOString();

      if (existing.count >= DRIFT_ADOPT_COUNT) {
        routine.typicalStart = toHHMM(evStart);
        routine.typicalEnd = toHHMM(evEnd);
        routine.confidence = Math.min(1, routine.confidence + 0.1);
        persona.notes.splice(existingIdx, 1);

        if (titleMatchesKeywords(routine.keyword, LUNCH_KEYWORDS)) {
          persona.activeHours.lunchStart = routine.typicalStart;
          persona.activeHours.lunchEnd = routine.typicalEnd;
        }
      }
    } else {
      persona.notes.push({
        createdAt: new Date().toISOString(),
        type: 'drift' as const,
        content: noteContent,
        relatedRoutine: routine.keyword,
        count: 1,
      });
    }

    changed = true;
  }

  if (changed) {
    if (persona.notes.length > MAX_NOTES) {
      persona.notes = persona.notes.slice(-MAX_NOTES);
    }
    persona.updatedAt = new Date().toISOString();
    await setPersona(persona);
  }
}

// ── Generate persona context for system prompt ──

export function buildPersonaPromptSection(persona: UserPersona): string {
  const { activeHours, routines, schedulingStyle, avgDailyEvents, bufferPreference, notes } = persona;

  const styleLabel: Record<SchedulingStyle, string> = {
    conservative: '보수적 (루틴 보호 우선, 여유 시간 확보)',
    moderate: '보통 (균형 잡힌 배치)',
    aggressive: '공격적 (빈 시간 최소화)',
  };

  let section = `## 사용자 프로필 (자동 분석 기반)\n`;
  section += `- 활동 시간: ${activeHours.workStart} ~ ${activeHours.workEnd}\n`;
  section += `- 점심 시간: ${activeHours.lunchStart} ~ ${activeHours.lunchEnd}\n`;
  section += `- 일일 평균 일정: ${avgDailyEvents}개\n`;
  section += `- 일정 간 선호 여유: ${bufferPreference}분\n`;
  section += `- 스케줄링 성향: ${styleLabel[schedulingStyle]}\n`;

  if (routines.length > 0) {
    section += `- 루틴:\n`;
    for (const r of routines.slice(0, 8)) {
      const days = r.dayOfWeek.length > 0
        ? r.dayOfWeek.map((d) => WEEKDAY_LABELS[d]).join('·')
        : '매일';
      section += `  - ${r.keyword}: ${days} ${r.typicalStart}~${r.typicalEnd} (신뢰도 ${Math.round(r.confidence * 100)}%)\n`;
    }
  }

  const recentDriftNotes = notes.filter((n) => n.type === 'drift' && n.count >= 2);
  if (recentDriftNotes.length > 0) {
    section += `- 최근 변화 감지:\n`;
    for (const n of recentDriftNotes) {
      section += `  - ${n.content} (${n.count}회 관찰)\n`;
    }
  }

  section += `\n### 페르소나 기반 행동 지침\n`;
  section += `- "점심 약속"이라고 하면 사용자의 평소 점심 시간(${activeHours.lunchStart})을 기준으로 제안하세요.\n`;
  section += `- 사용자의 루틴 시간대에 겹치는 일정을 만들 때는 반드시 확인을 받으세요.\n`;

  if (schedulingStyle === 'conservative') {
    section += `- 일정 전후 최소 ${bufferPreference}분 여유를 확보하세요.\n`;
    section += `- 루틴과 겹칠 가능성이 있으면 대안 시간을 먼저 제시하세요.\n`;
  } else if (schedulingStyle === 'aggressive') {
    section += `- 빈 시간이 있으면 적극적으로 활용해도 됩니다.\n`;
    section += `- 여유 시간 확보보다 효율적 배치를 우선하세요.\n`;
  }

  return section;
}
