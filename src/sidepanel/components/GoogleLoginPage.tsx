import { CalendarDaysIcon } from '@heroicons/react/24/outline'

interface GoogleLoginPageProps {
  onSignIn: () => void
  loading: boolean
  error: string | null
}

export default function GoogleLoginPage({ onSignIn, loading, error }: GoogleLoginPageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <CalendarDaysIcon className="w-9 h-9 text-accent" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">SmartCalendar</h1>
          <p className="text-sm text-text-secondary mt-1">
            AI 기반 Google Calendar 어시스턴트
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="w-full max-w-xs space-y-3">
        <div className="flex items-start gap-3 text-sm text-text-secondary">
          <span className="text-accent mt-0.5">&#10003;</span>
          <span>자연어로 일정을 추가, 수정, 삭제</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-text-secondary">
          <span className="text-accent mt-0.5">&#10003;</span>
          <span>일정 충돌 감지 및 최적 시간 추천</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-text-secondary">
          <span className="text-accent mt-0.5">&#10003;</span>
          <span>Google Calendar와 실시간 동기화</span>
        </div>
      </div>

      {/* Login button */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                     bg-white text-gray-700 font-medium text-sm
                     border border-gray-200 hover:bg-gray-50
                     transition-colors duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-sm"
        >
          {loading ? (
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google 계정으로 로그인
            </>
          )}
        </button>

        {error && (
          <p className="text-xs text-error text-center">{error}</p>
        )}

        <p className="text-2xs text-text-tertiary text-center">
          Google Calendar 읽기/쓰기 권한을 요청합니다.
          <br />
          데이터는 로컬에서만 처리됩니다.
        </p>
      </div>
    </div>
  )
}
