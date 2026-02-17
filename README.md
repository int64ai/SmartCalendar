# SmartCalendar Chrome Extension

AI 기반 자연어 캘린더 어시스턴트 Chrome 확장 프로그램.
Anthropic Claude API를 사용하여 자연어로 일정을 관리합니다.

## 기능

- 자연어로 일정 생성/수정/삭제 ("내일 오전 10시에 회의 잡아줘")
- 일정 조회 및 검색 ("이번 주 일정 보여줘")
- 빈 시간 찾기, 충돌 확인, 최적 시간 추천
- 일정 변경 취소(Undo) 지원
- 다크/라이트 테마

## 사전 준비

- **Chrome 브라우저** (버전 116 이상, Side Panel API 지원)
- **Anthropic API Key** ([console.anthropic.com](https://console.anthropic.com/)에서 발급)
- **Node.js** 18 이상 (빌드 시에만 필요)

## 설치 방법 (개발자 모드)

### 1. 소스 코드 받기

```bash
git clone https://github.com/int64ai/SmartCalendar.git
cd SmartCalendar
```

### 2. 의존성 설치 및 빌드

```bash
npm install
npm run build
```

빌드가 완료되면 `dist/` 폴더가 생성됩니다.

### 3. Chrome에 확장 프로그램 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단의 **"개발자 모드"** 토글을 켜기
3. **"압축해제된 확장 프로그램을 로드합니다"** 버튼 클릭
4. `dist/` 폴더를 선택
5. "SmartCalendar" 확장 프로그램이 목록에 나타나면 성공

### 4. API Key 설정

1. Chrome 툴바에서 SmartCalendar 아이콘 클릭 → Side Panel 열림
2. API Key가 없으면 자동으로 설정 페이지 표시
3. [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key로 발급
4. `sk-ant-...` 형식의 키를 입력하고 **"저장"** 클릭
5. 채팅 화면으로 전환됨

## 사용법

### 일정 생성
```
"내일 오전 10시에 팀 회의 만들어줘"
"3월 5일 오후 2시부터 3시까지 치과 예약"
"매주 월요일 9시에 스탠드업 미팅"
```

### 일정 조회
```
"오늘 일정 보여줘"
"이번 주 일정 알려줘"
"3월 일정 목록"
```

### 일정 검색
```
"회의 관련 일정 찾아줘"
"다음 주 팀 미팅 있어?"
```

### 일정 수정/삭제
```
"오늘 회의 시간을 오후 3시로 변경해줘"
"내일 치과 예약 취소해줘"
```

### 되돌리기
```
"방금 삭제한 거 취소해줘"
"되돌려줘"
```

### 빈 시간 찾기
```
"내일 1시간짜리 빈 시간 찾아줘"
"이번 주에 2시간 여유 있는 시간대 알려줘"
```

## 설정

Side Panel 우측 상단 톱니바퀴(⚙) 아이콘 → 설정 페이지:

- **API Key**: Anthropic API 키 (로컬에만 저장, 외부 전송 없음)
- **모델**: Claude Sonnet 4 / Claude Haiku 4 선택
- **테마**: 다크 / 라이트 / 시스템

## 코드 수정 후 반영

코드를 수정한 후:

```bash
npm run build
```

그 다음 `chrome://extensions`에서 SmartCalendar 카드의 **새로고침 아이콘(↻)** 클릭.

## 개발

```bash
npm run test          # 테스트 실행
npm run test:watch    # 테스트 워치 모드
npm run dev:panel     # Side Panel 개발 서버
npm run dev:bg        # Service Worker 워치 빌드
```

## 프로젝트 구조

```
src/
  api/                  # Anthropic API 클라이언트, 도구 사용 루프
  background/           # Chrome Service Worker
  data/                 # Dexie.js/IndexedDB 데이터 레이어
  shared/               # 타입, 상수, 메시지 프로토콜
  sidepanel/            # React Side Panel UI
    components/         # ChatPanel, ChatMessage, SettingsPage, Toast
    hooks/              # useChat, useSettings, useTheme, useToast
  tools/                # 캘린더 도구 (조회, 변경, 분석, 추천)
tests/                  # Vitest 유닛 테스트 (50개)
public/                 # manifest.json, 아이콘
```

## 기술 스택

- **UI**: React 18, TypeScript, Tailwind CSS, Vite
- **데이터**: Dexie.js (IndexedDB)
- **AI**: Anthropic Claude API (Messages API, Tool Use)
- **플랫폼**: Chrome Extension Manifest V3, Side Panel API

## Chrome Web Store 배포 (선택)

Chrome Web Store에 배포하려면:

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
2. 개발자 등록 (최초 1회, $5 등록비)
3. `dist/` 폴더를 ZIP으로 압축: `cd dist && zip -r ../smartcalendar.zip . && cd ..`
4. Dashboard에서 "새 항목" → ZIP 업로드
5. 스토어 등록 정보 입력 (설명, 스크린샷, 카테고리 등)
6. "심사를 위해 제출" 클릭
7. 심사 통과 후 (보통 1~3일) 스토어에 게시됨

### 심사 주의사항

- `host_permissions`에 `api.anthropic.com`만 있으므로 심사가 비교적 수월
- 원격 코드 실행(eval, Function constructor 등) 금지
- 개인정보처리방침 URL 필요 (간단한 페이지라도 OK)
- 스크린샷 최소 1장 필요 (1280x800 또는 640x400)
