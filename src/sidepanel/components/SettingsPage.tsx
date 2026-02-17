import { useState, useEffect } from 'react'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useSettings } from '../hooks/useSettings'
import { useTheme, Theme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'

interface SettingsPageProps {
  onBack: () => void
  showBackButton: boolean
}

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
]

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: '다크' },
  { value: 'light', label: '라이트' },
  { value: 'system', label: '시스템' },
]

export default function SettingsPage({ onBack, showBackButton }: SettingsPageProps) {
  const { settings, updateSettings, loading } = useSettings()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()

  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-20250514')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Sync local state once when settings finish loading
  useEffect(() => {
    if (!loading && !initialized) {
      setApiKey(settings.apiKey)
      setModel(settings.model)
      setInitialized(true)
    }
  }, [loading, initialized, settings.apiKey, settings.model])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showToast({ type: 'error', message: 'API 키를 입력해주세요.' })
      return
    }
    setIsSaving(true)
    try {
      await updateSettings({ apiKey: apiKey.trim(), model })
      showToast({ type: 'success', message: '설정이 저장되었습니다.' })
      if (showBackButton) {
        onBack()
      }
    } catch {
      showToast({ type: 'error', message: '설정 저장에 실패했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {showBackButton && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
            title="뒤로"
          >
            <ArrowLeftIcon className="w-4 h-4 text-text-secondary" />
          </button>
        )}
        <span className="font-medium">설정</span>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">Anthropic API 키</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="input pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
              type="button"
            >
              {showKey ? (
                <EyeSlashIcon className="w-4 h-4 text-text-tertiary" />
              ) : (
                <EyeIcon className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
          </div>
          <p className="text-2xs text-text-tertiary">
            API 키는 로컬에만 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">모델</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="input"
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Theme selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">테마</label>
          <div className="flex gap-2">
            {THEMES.map(t => (
              <button
                key={t.value}
                onClick={() => handleThemeChange(t.value)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  theme === t.value
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary w-full"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
