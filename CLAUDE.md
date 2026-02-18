# SmartCalendar Chrome Extension

Chrome 확장 프로그램 (Manifest V3 Side Panel) — Google Calendar 연동 AI 캘린더 어시스턴트.
서버 없이 클라이언트만으로 동작 (chrome.identity API로 OAuth 처리).

## Architecture

- **UI**: React 18 + TypeScript / Tailwind CSS / Vite (Side Panel)
  - 미니 캘린더 + 어젠다 리스트 + AI 채팅 통합
- **AI**: Multi-provider 지원 (Anthropic, OpenAI, Google Gemini, AWS Bedrock)
  - Provider 추상화 레이어 (`src/api/providers/`)
  - 통합 메시지 포맷 (Anthropic 기반) + 프로바이더별 변환
- **Calendar**: Google Calendar API 연동 (`src/api/google-calendar.ts`)
  - chrome.identity OAuth2 인증
  - ICalendarBase 인터페이스로 추상화 (`src/data/calendar-base.ts`)
  - SmartCalendar 메타데이터(category, tags, priority)는 extendedProperties에 저장
- **Storage**: chrome.storage.local (provider, credentials, model, theme, googleSignedIn, userPersona)
- **Persona**: 유저 페르소나 시스템 (`src/tools/persona.ts`)
  - 과거 일정 통계 분석 → 루틴/선호 시간대/스케줄링 성향 추출
  - 초기 1회 셋업 (설정 페이지) + 드리프트 감지 자동 업데이트 + 명시적 채팅 업데이트
  - 시스템 프롬프트에 페르소나 컨텍스트 주입, calculateTimeScore 개인화

## Commands

- `npm run build` — 전체 빌드 (Side Panel + Service Worker)
- `npm run build:panel` — Side Panel 빌드
- `npm run build:bg` — Service Worker 빌드
- `npm test` — 테스트 실행

## Setup

1. Google Cloud Console에서 OAuth 2.0 Client ID 생성 (Chrome Extension 유형)
2. `public/manifest.json`의 `oauth2.client_id`를 발급받은 Client ID로 교체
3. `npm run build` 후 Chrome에 확장 프로그램 로드

## Directory Structure

```
src/
  shared/          # 타입, 상수, 메시지 프로토콜, 스토리지
  data/
    calendar-base.ts  # ICalendarBase 인터페이스
    google-calendar.ts # Google Calendar API 어댑터
    calendar.ts        # (레거시) Dexie DB 구현
    database.ts        # (레거시) IndexedDB 스키마
  tools/           # 15개 캘린더 도구 (query, mutation, analysis, recommend, persona)
  api/
    google-calendar.ts # Google Calendar API 클라이언트 + OAuth
    providers/     # AI 프로바이더 (anthropic, openai, gemini, bedrock)
      types.ts     # AIProvider 인터페이스, 통합 메시지 타입
      index.ts     # createProvider 팩토리, 모델 카탈로그
    tool-use-loop.ts  # 프로바이더 무관 tool-use 루프
    system-prompt.ts  # 동적 시스템 프롬프트 생성
  background/      # Service Worker (chrome.runtime 메시지 핸들러)
  sidepanel/       # React UI
    components/
      GoogleLoginPage.tsx  # Google OAuth 로그인
      MiniCalendar.tsx     # 월간 미니 캘린더
      AgendaList.tsx       # 일별 어젠다 리스트
      ChatPanel.tsx        # AI 채팅 (calendarContext 연동)
      SettingsPage.tsx     # AI 프로바이더 설정 + Google 로그아웃
      ChatMessage.tsx      # 마크다운 메시지 렌더링
      Toast/               # 토스트 알림
    hooks/
      useGoogleAuth.ts     # Google 인증 상태 관리
      useCalendarEvents.ts # 캘린더 이벤트 페칭
      useChat.ts           # 채팅 상태 (calendarContext 전달)
      useSettings.ts       # AI 설정
      usePersona.ts        # 페르소나 상태 관리
      useTheme.ts          # 테마
```
