import { describe, it, expect } from 'vitest';
import { DexieCalendar } from '../../src/data/calendar';
import { calculateTimeScore } from '../../src/tools/recommend';
import type { UserPersona } from '../../src/shared/types';

function makePersona(overrides?: Partial<UserPersona>): UserPersona {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    activeHours: {
      workStart: '09:00',
      workEnd: '18:00',
      lunchStart: '12:30',
      lunchEnd: '13:30',
    },
    routines: [
      { keyword: '스탠드업', dayOfWeek: [1, 2, 3, 4, 5], typicalStart: '09:30', typicalEnd: '10:00', confidence: 0.9 },
      { keyword: '점심', dayOfWeek: [], typicalStart: '12:30', typicalEnd: '13:30', confidence: 0.85 },
    ],
    weekdayProfile: {},
    schedulingStyle: 'moderate',
    preferredMeetingTimes: ['10:00', '14:00'],
    avgDailyEvents: 5,
    bufferPreference: 15,
    notes: [],
    ...overrides,
  };
}

describe('Personalized Time Scoring', () => {
  describe('calculateTimeScore without persona (fallback)', () => {
    it('should return hardcoded scores when no persona', () => {
      expect(calculateTimeScore(new Date('2026-02-16T10:00:00'))).toBe(100);
      expect(calculateTimeScore(new Date('2026-02-16T14:00:00'))).toBe(95);
      expect(calculateTimeScore(new Date('2026-02-16T20:00:00'))).toBe(50);
    });

    it('should return hardcoded scores when persona is null', () => {
      expect(calculateTimeScore(new Date('2026-02-16T10:00:00'), null)).toBe(100);
    });
  });

  describe('calculateTimeScore with persona', () => {
    const persona = makePersona();

    it('should penalize lunch time heavily', () => {
      const lunchScore = calculateTimeScore(new Date('2026-02-16T12:30:00'), persona);
      const morningScore = calculateTimeScore(new Date('2026-02-16T10:30:00'), persona);
      expect(lunchScore).toBeLessThan(morningScore);
    });

    it('should score outside active hours very low', () => {
      const score = calculateTimeScore(new Date('2026-02-16T07:00:00'), persona);
      expect(score).toBe(20);
    });

    it('should score after work end very low', () => {
      const score = calculateTimeScore(new Date('2026-02-16T19:00:00'), persona);
      expect(score).toBe(20);
    });

    it('should boost preferred meeting times', () => {
      const preferredScore = calculateTimeScore(new Date('2026-02-16T10:00:00'), persona);
      const nonPreferredScore = calculateTimeScore(new Date('2026-02-16T11:00:00'), persona);
      // 10:00 is a preferred meeting time, 11:00 is not
      // But 10:00 also overlaps with standup routine penalty, so let's check a cleaner example
      const afternoon = calculateTimeScore(new Date('2026-02-16T14:00:00'), persona);
      const nonPreferredAfternoon = calculateTimeScore(new Date('2026-02-16T15:00:00'), persona);
      expect(afternoon).toBeGreaterThan(nonPreferredAfternoon);
    });

    it('should penalize routine times', () => {
      // 09:30 is standup time with high confidence
      const standupScore = calculateTimeScore(new Date('2026-02-16T09:30:00'), persona);
      // 16:00 has no routine
      const clearScore = calculateTimeScore(new Date('2026-02-16T16:00:00'), persona);
      expect(standupScore).toBeLessThan(clearScore);
    });
  });

  describe('calculateTimeScore with different scheduling styles', () => {
    it('should work with conservative persona', () => {
      const persona = makePersona({ schedulingStyle: 'conservative' });
      const score = calculateTimeScore(new Date('2026-02-16T11:00:00'), persona);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should work with aggressive persona', () => {
      const persona = makePersona({ schedulingStyle: 'aggressive' });
      const score = calculateTimeScore(new Date('2026-02-16T11:00:00'), persona);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

describe('Persona Analysis Integration', () => {
  it('should analyze events and produce a persona', async () => {
    const calendar = new DexieCalendar();

    // Simulate 4 weeks of recurring events
    const weeks = 4;
    for (let w = 0; w < weeks; w++) {
      for (let d = 1; d <= 5; d++) {
        const baseDate = new Date(2026, 0, 5 + w * 7 + d);
        const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;

        await calendar.createEvent({
          id: `standup_w${w}_d${d}`, title: '데일리 스탠드업',
          start: `${dateStr}T09:30:00`, end: `${dateStr}T10:00:00`,
          category: 'meeting', tags: [], is_movable: false, priority: 2,
        });

        await calendar.createEvent({
          id: `lunch_w${w}_d${d}`, title: '점심',
          start: `${dateStr}T12:30:00`, end: `${dateStr}T13:30:00`,
          category: 'general', tags: [], is_movable: true, priority: 3,
        });

        await calendar.createEvent({
          id: `meeting_w${w}_d${d}`, title: '팀 회의',
          start: `${dateStr}T14:00:00`, end: `${dateStr}T15:00:00`,
          category: 'meeting', tags: [], is_movable: true, priority: 3,
        });
      }
    }

    // Import and test analyzeUserPatterns (uses ICalendarBase interface)
    const { analyzeUserPatterns } = await import('../../src/tools/persona');
    const { persona, summary } = await analyzeUserPatterns(calendar);

    expect(persona.version).toBe(1);
    expect(persona.activeHours).toBeDefined();
    expect(persona.routines.length).toBeGreaterThan(0);
    expect(persona.avgDailyEvents).toBeGreaterThan(0);
    expect(summary).toContain('분석');

    // Lunch should be detected around 12:30
    const lunchRoutine = persona.routines.find(r => r.keyword === '점심');
    expect(lunchRoutine).toBeDefined();
    expect(lunchRoutine!.typicalStart).toBe('12:30');

    // Standup should be detected
    const standupRoutine = persona.routines.find(r => r.keyword === '스탠드업' || r.keyword === '데일리');
    expect(standupRoutine).toBeDefined();
  });
});
