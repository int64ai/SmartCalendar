# SmartCalendar Chrome Extension

Chrome 확장 프로그램 (Manifest V3 Side Panel) — 서버 없이 클라이언트만으로 동작.

## Architecture

- **UI**: React 18 + TypeScript / Tailwind CSS / Vite (Side Panel)
- **AI**: Anthropic Messages API (직접 호출, `anthropic-dangerous-direct-browser-access` 헤더)
- **Database**: Dexie.js (IndexedDB) — events, undoLogs
- **Storage**: chrome.storage.local (API key, model, theme)

## Commands

- `npm run build` — 전체 빌드 (Side Panel + Service Worker)
- `npm run build:panel` — Side Panel 빌드
- `npm run build:bg` — Service Worker 빌드
- `npm test` — 테스트 실행

## Directory Structure

```
src/
  shared/          # 타입, 상수, 메시지 프로토콜, 스토리지
  data/            # Dexie DB, Calendar CRUD + Undo
  tools/           # 10개 캘린더 도구 (query, mutation, analysis, recommend)
  api/             # Anthropic 클라이언트, tool-use 루프, 시스템 프롬프트
  background/      # Service Worker (chrome.runtime 메시지 핸들러)
  sidepanel/       # React UI (ChatPanel, Settings, Toast)
```
