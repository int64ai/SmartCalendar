/** Tool definitions and dispatcher (ported from server.py) */

import type { ICalendarBase } from '../data/calendar-base';
import * as queryTools from './query';
import * as mutationTools from './mutation';
import * as analysisTools from './analysis';
import * as recommendTools from './recommend';
import * as personaTools from './persona';
import { getPersona } from '../shared/storage';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'ping',
    description: '서버 연결 테스트용 간단한 응답을 반환합니다',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_events',
    description: '지정된 기간의 일정을 조회합니다',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: '시작 날짜 (YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS)',
        },
        end_date: {
          type: 'string',
          description: '종료 날짜 (YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS)',
        },
        category: {
          type: 'string',
          description:
            '(선택) 카테고리 필터: dax-web, dax-sl, etc, meeting, ai, general',
          enum: ['dax-web', 'dax-sl', 'etc', 'meeting', 'ai', 'general'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '(선택) 태그 필터',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'search_events',
    description:
      '키워드로 일정을 검색합니다. 제목, 설명, 태그에서 검색합니다.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색 키워드',
        },
        start_date: {
          type: 'string',
          description: '(선택) 검색 시작 날짜 (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: '(선택) 검색 종료 날짜 (YYYY-MM-DD)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_free_slots',
    description: '특정 날짜의 빈 시간대를 찾습니다',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: '날짜 (YYYY-MM-DD)',
        },
        duration_minutes: {
          type: 'integer',
          description: '필요한 시간 (분)',
        },
        time_range_start: {
          type: 'string',
          description: '(선택) 검색 시작 시간 (HH:MM), 기본값: 09:00',
        },
        time_range_end: {
          type: 'string',
          description: '(선택) 검색 종료 시간 (HH:MM), 기본값: 18:00',
        },
      },
      required: ['date', 'duration_minutes'],
    },
  },
  {
    name: 'check_conflicts',
    description: '새 일정이 기존 일정과 충돌하는지 확인합니다',
    input_schema: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          description: '새 일정 시작 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
        end: {
          type: 'string',
          description: '새 일정 종료 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'find_related_events',
    description: '비슷한 제목의 과거 일정을 찾습니다. 패턴 분석용.',
    input_schema: {
      type: 'object',
      properties: {
        title_keyword: {
          type: 'string',
          description: '검색할 키워드',
        },
        limit: {
          type: 'integer',
          description: '(선택) 최대 반환 개수, 기본값: 10',
        },
      },
      required: ['title_keyword'],
    },
  },
  {
    name: 'get_event_context',
    description:
      '특정 일정 전후의 일정들을 조회합니다. 연관 일정 파악용.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: '기준 일정 ID',
        },
        hours_before: {
          type: 'integer',
          description: '(선택) 몇 시간 전까지 조회, 기본값: 3',
        },
        hours_after: {
          type: 'integer',
          description: '(선택) 몇 시간 후까지 조회, 기본값: 3',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'create_event',
    description: '새 일정을 생성합니다',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '일정 제목',
        },
        start: {
          type: 'string',
          description: '시작 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
        end: {
          type: 'string',
          description: '종료 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
        category: {
          type: 'string',
          description:
            '(선택) 카테고리: dax-web, dax-sl, etc, meeting, ai, general',
          enum: ['dax-web', 'dax-sl', 'etc', 'meeting', 'ai', 'general'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '(선택) 태그 목록',
        },
        description: {
          type: 'string',
          description: '(선택) 일정 설명',
        },
        location: {
          type: 'string',
          description: '(선택) 장소',
        },
        is_movable: {
          type: 'boolean',
          description: '(선택) 이동 가능 여부, 기본값: true',
        },
        priority: {
          type: 'integer',
          description: '(선택) 우선순위 1(최고)~5(최저), 기본값: 3',
        },
        colorId: {
          type: 'string',
          description: '(선택) Google Calendar 색상 ID (1~11). 1:라벤더, 2:세이지, 3:그레이프, 4:플라밍고, 5:바나나, 6:탠저린, 7:피콕, 8:그래파이트, 9:블루베리, 10:베이질, 11:토마토',
        },
        attendees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', description: '참석자 이메일 (필수)' },
              displayName: { type: 'string', description: '(선택) 표시 이름' },
              optional: { type: 'boolean', description: '(선택) 선택적 참석자 여부' },
            },
            required: ['email'],
          },
          description: '(선택) 참석자 목록',
        },
        reminders: {
          type: 'object',
          properties: {
            useDefault: { type: 'boolean', description: '기본 알림 사용 여부' },
            overrides: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string', enum: ['email', 'popup'], description: '알림 방식' },
                  minutes: { type: 'integer', description: '일정 시작 몇 분 전 알림' },
                },
                required: ['method', 'minutes'],
              },
              description: '(선택) 커스텀 알림 목록',
            },
          },
          required: ['useDefault'],
          description: '(선택) 알림 설정. useDefault=true이면 기본 알림, false이면 overrides 사용',
        },
        recurrence: {
          type: 'array',
          items: { type: 'string' },
          description: '(선택) 반복 규칙 (RRULE 형식). 예: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"], ["RRULE:FREQ=DAILY;COUNT=10"]',
        },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'update_event',
    description: '기존 일정을 수정합니다',
    input_schema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: '수정할 일정 ID',
        },
        title: {
          type: 'string',
          description: '(선택) 새 제목',
        },
        start: {
          type: 'string',
          description: '(선택) 새 시작 시간',
        },
        end: {
          type: 'string',
          description: '(선택) 새 종료 시간',
        },
        category: {
          type: 'string',
          description: '(선택) 새 카테고리',
          enum: ['dax-web', 'dax-sl', 'etc', 'meeting', 'ai', 'general'],
        },
        description: {
          type: 'string',
          description: '(선택) 새 설명',
        },
        location: {
          type: 'string',
          description: '(선택) 새 장소',
        },
        colorId: {
          type: 'string',
          description: '(선택) Google Calendar 색상 ID (1~11). 1:라벤더, 2:세이지, 3:그레이프, 4:플라밍고, 5:바나나, 6:탠저린, 7:피콕, 8:그래파이트, 9:블루베리, 10:베이질, 11:토마토',
        },
        attendees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', description: '참석자 이메일 (필수)' },
              displayName: { type: 'string', description: '(선택) 표시 이름' },
              optional: { type: 'boolean', description: '(선택) 선택적 참석자 여부' },
            },
            required: ['email'],
          },
          description: '(선택) 참석자 목록 (기존 목록을 완전히 대체)',
        },
        reminders: {
          type: 'object',
          properties: {
            useDefault: { type: 'boolean', description: '기본 알림 사용 여부' },
            overrides: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string', enum: ['email', 'popup'], description: '알림 방식' },
                  minutes: { type: 'integer', description: '일정 시작 몇 분 전 알림' },
                },
                required: ['method', 'minutes'],
              },
              description: '(선택) 커스텀 알림 목록',
            },
          },
          required: ['useDefault'],
          description: '(선택) 알림 설정',
        },
        recurrence: {
          type: 'array',
          items: { type: 'string' },
          description: '(선택) 반복 규칙 (RRULE 형식)',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'delete_event',
    description: '일정을 삭제합니다',
    input_schema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: '삭제할 일정 ID',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'suggest_optimal_times',
    description: '주어진 조건에 맞는 최적의 시간대를 추천합니다',
    input_schema: {
      type: 'object',
      properties: {
        duration_minutes: {
          type: 'integer',
          description: '필요한 시간 (분)',
        },
        preferred_dates: {
          type: 'array',
          items: { type: 'string' },
          description: '선호 날짜들 (YYYY-MM-DD)',
        },
        time_range_start: {
          type: 'string',
          description: '(선택) 검색 시작 시간 (HH:MM), 기본값: 09:00',
        },
        time_range_end: {
          type: 'string',
          description: '(선택) 검색 종료 시간 (HH:MM), 기본값: 18:00',
        },
        avoid_categories: {
          type: 'array',
          items: { type: 'string' },
          description: '(선택) 피할 카테고리 목록',
        },
        buffer_minutes: {
          type: 'integer',
          description: '(선택) 일정 전후 여유 시간 (분), 기본값: 0',
        },
      },
      required: ['duration_minutes', 'preferred_dates'],
    },
  },
  {
    name: 'propose_schedule_adjustment',
    description:
      '새 일정을 추가하기 위해 기존 일정을 어떻게 조정하면 좋을지 제안합니다',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '새 일정 제목',
        },
        start: {
          type: 'string',
          description: '새 일정 시작 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
        end: {
          type: 'string',
          description: '새 일정 종료 시간 (YYYY-MM-DDTHH:MM:SS)',
        },
        priority: {
          type: 'integer',
          description:
            '(선택) 새 일정 우선순위 1(최고)~5(최저), 기본값: 3',
        },
        strategy: {
          type: 'string',
          description:
            '(선택) 조정 전략: minimize_moves, respect_priority, keep_buffer',
          enum: ['minimize_moves', 'respect_priority', 'keep_buffer'],
        },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'undo_event',
    description:
      '직전 일정 변경(생성/수정/삭제)을 되돌립니다. change_set_id를 지정해야 합니다.',
    input_schema: {
      type: 'object',
      properties: {
        change_set_id: {
          type: 'string',
          description:
            '되돌릴 변경의 change_set_id (mutation 결과에 포함됨)',
        },
      },
      required: ['change_set_id'],
    },
  },
  {
    name: 'analyze_user_patterns',
    description:
      '사용자의 과거 일정을 분석하여 루틴, 선호 시간대, 스케줄링 성향 등의 페르소나를 생성합니다. 사용자가 "내 패턴 분석해줘", "내 일정 습관 알려줘" 등을 요청했을 때 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_persona',
    description:
      '사용자가 명시적으로 자신의 프로필 변경을 요청했을 때 페르소나를 업데이트합니다. 예: "출근 시간이 10시로 바뀌었어", "점심은 보통 1시에 먹어", "나는 일정 빡빡하게 잡는 걸 좋아해"',
    input_schema: {
      type: 'object',
      properties: {
        active_hours: {
          type: 'object',
          properties: {
            work_start: { type: 'string', description: '출근 시간 (HH:MM)' },
            work_end: { type: 'string', description: '퇴근 시간 (HH:MM)' },
            lunch_start: { type: 'string', description: '점심 시작 (HH:MM)' },
            lunch_end: { type: 'string', description: '점심 종료 (HH:MM)' },
          },
          description: '(선택) 활동 시간 변경',
        },
        scheduling_style: {
          type: 'string',
          enum: ['conservative', 'moderate', 'aggressive'],
          description: '(선택) 스케줄링 성향. conservative=보수적/여유, moderate=보통, aggressive=공격적/빡빡',
        },
        buffer_preference: {
          type: 'integer',
          description: '(선택) 일정 간 선호 여유 시간 (분)',
        },
        reason: {
          type: 'string',
          description: '변경 사유 (사용자의 원래 요청을 요약)',
        },
      },
      required: ['reason'],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  calendar: ICalendarBase,
): Promise<unknown> {
  switch (name) {
    case 'ping':
      return {
        status: 'ok',
        message: 'Calendar MCP Server가 정상 동작 중입니다.',
      };

    case 'get_events':
      return queryTools.getEvents(
        calendar,
        args.start_date as string,
        args.end_date as string,
        args.category as string | undefined,
        args.tags as string[] | undefined,
      );

    case 'search_events':
      return queryTools.searchEvents(
        calendar,
        args.query as string,
        args.start_date as string | undefined,
        args.end_date as string | undefined,
      );

    case 'get_free_slots': {
      let timeRange: [string, string] | undefined;
      if (args.time_range_start && args.time_range_end) {
        timeRange = [
          args.time_range_start as string,
          args.time_range_end as string,
        ];
      }
      return queryTools.getFreeSlots(
        calendar,
        args.date as string,
        args.duration_minutes as number,
        timeRange,
      );
    }

    case 'check_conflicts':
      return analysisTools.checkConflicts(
        calendar,
        args.start as string,
        args.end as string,
      );

    case 'find_related_events':
      return analysisTools.findRelatedEvents(
        calendar,
        args.title_keyword as string,
        (args.limit as number) ?? 10,
      );

    case 'get_event_context':
      return analysisTools.getEventContext(
        calendar,
        args.event_id as string,
        (args.hours_before as number) ?? 3,
        (args.hours_after as number) ?? 3,
      );

    case 'create_event':
      return mutationTools.createEvent(
        calendar,
        args.title as string,
        args.start as string,
        args.end as string,
        (args.category as string) ?? 'general',
        args.tags as string[] | undefined,
        args.description as string | undefined,
        args.location as string | undefined,
        (args.is_movable as boolean) ?? true,
        (args.priority as number) ?? 3,
        args.colorId as string | undefined,
        args.attendees as Array<{ email: string; displayName?: string; optional?: boolean }> | undefined,
        args.reminders as { useDefault: boolean; overrides?: Array<{ method: 'email' | 'popup'; minutes: number }> } | undefined,
        args.recurrence as string[] | undefined,
      );

    case 'update_event': {
      const changes: Record<string, unknown> = {};
      for (const key of [
        'title',
        'start',
        'end',
        'category',
        'description',
        'location',
        'tags',
        'is_movable',
        'priority',
        'colorId',
        'attendees',
        'reminders',
        'recurrence',
      ]) {
        if (key in args) {
          changes[key] = args[key];
        }
      }
      return mutationTools.updateEvent(
        calendar,
        args.event_id as string,
        changes,
      );
    }

    case 'delete_event':
      return mutationTools.deleteEvent(
        calendar,
        args.event_id as string,
      );

    case 'suggest_optimal_times': {
      const constraints: Record<string, unknown> = {};
      if (args.time_range_start && args.time_range_end) {
        constraints.time_range = [
          args.time_range_start as string,
          args.time_range_end as string,
        ];
      }
      if (args.avoid_categories) {
        constraints.avoid_categories = args.avoid_categories;
      }
      if (args.buffer_minutes) {
        constraints.buffer_minutes = args.buffer_minutes;
      }
      const persona = await getPersona();
      return recommendTools.suggestOptimalTimes(
        calendar,
        args.duration_minutes as number,
        args.preferred_dates as string[],
        Object.keys(constraints).length > 0 ? constraints : undefined,
        persona,
      );
    }

    case 'propose_schedule_adjustment': {
      const newEvent = {
        title: args.title as string,
        start: args.start as string,
        end: args.end as string,
        priority: (args.priority as number) ?? 3,
      };
      return recommendTools.proposeScheduleAdjustment(
        calendar,
        newEvent,
        (args.strategy as string) ?? 'minimize_moves',
      );
    }

    case 'undo_event': {
      const changeSetId = args.change_set_id as string;
      const success = await calendar.undo(changeSetId);
      if (success) {
        return {
          success: true,
          message: `변경이 되돌려졌습니다. (change_set_id: ${changeSetId})`,
        };
      }
      return {
        success: false,
        error: `되돌릴 변경을 찾을 수 없습니다: ${changeSetId}`,
      };
    }

    case 'analyze_user_patterns':
      return personaTools.analyzeUserPatterns(calendar);

    case 'update_persona': {
      const changes: Parameters<typeof personaTools.updatePersona>[0] = {};
      if (args.active_hours) {
        const ah = args.active_hours as Record<string, string>;
        changes.activeHours = {};
        if (ah.work_start) changes.activeHours.workStart = ah.work_start;
        if (ah.work_end) changes.activeHours.workEnd = ah.work_end;
        if (ah.lunch_start) changes.activeHours.lunchStart = ah.lunch_start;
        if (ah.lunch_end) changes.activeHours.lunchEnd = ah.lunch_end;
      }
      if (args.scheduling_style) {
        changes.schedulingStyle = args.scheduling_style as 'conservative' | 'moderate' | 'aggressive';
      }
      if (args.buffer_preference !== undefined) {
        changes.bufferPreference = args.buffer_preference as number;
      }
      const updated = await personaTools.updatePersona(changes, args.reason as string);
      return { success: true, persona: updated, message: '프로필이 업데이트되었습니다.' };
    }

    default:
      return { error: `알 수 없는 tool: ${name}` };
  }
}
