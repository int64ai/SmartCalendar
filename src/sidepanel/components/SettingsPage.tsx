import { useState, useEffect } from 'react'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useSettings } from '../hooks/useSettings'
import { useTheme, Theme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { usePersona } from '../hooks/usePersona'
import { ALL_PROVIDER_IDS, PROVIDER_LABELS, PROVIDER_MODELS, getBedrockModelsForRegion } from '../../api/providers/index'
import type { ProviderId } from '../../api/providers/types'

interface SettingsPageProps {
  onBack: () => void
  showBackButton: boolean
  onSignOut?: () => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: '다크' },
  { value: 'light', label: '라이트' },
  { value: 'system', label: '시스템' },
]

const BEDROCK_REGIONS = [
  // North America
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'ca-west-1', label: 'Canada (Calgary)' },
  { value: 'mx-central-1', label: 'Mexico (Central)' },
  // South America
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
  // Europe
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-central-2', label: 'Europe (Zurich)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  { value: 'eu-south-1', label: 'Europe (Milan)' },
  { value: 'eu-south-2', label: 'Europe (Spain)' },
  // Asia Pacific
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'Asia Pacific (Osaka)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-south-2', label: 'Asia Pacific (Hyderabad)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-southeast-3', label: 'Asia Pacific (Jakarta)' },
  { value: 'ap-southeast-4', label: 'Asia Pacific (Melbourne)' },
  { value: 'ap-southeast-5', label: 'Asia Pacific (Malaysia)' },
  { value: 'ap-southeast-7', label: 'Asia Pacific (Thailand)' },
  { value: 'ap-east-2', label: 'Asia Pacific (Malaysia 2)' },
  // Middle East & Africa
  { value: 'me-central-1', label: 'Middle East (UAE)' },
  { value: 'me-south-1', label: 'Middle East (Bahrain)' },
  { value: 'af-south-1', label: 'Africa (Cape Town)' },
  { value: 'il-central-1', label: 'Israel (Tel Aviv)' },
]

export default function SettingsPage({ onBack, showBackButton, onSignOut }: SettingsPageProps) {
  const { settings, updateSettings, loading } = useSettings()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const { persona, loading: personaLoading, error: personaError, summary: personaSummary, runSetup } = usePersona()

  const [provider, setProvider] = useState<ProviderId>('anthropic')
  const [model, setModel] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('')
  const [bedrockSecretAccessKey, setBedrockSecretAccessKey] = useState('')
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Sync local state once when settings finish loading
  useEffect(() => {
    if (!loading && !initialized) {
      setProvider(settings.provider)
      setModel(settings.model)
      setAnthropicApiKey(settings.anthropicApiKey)
      setOpenaiApiKey(settings.openaiApiKey)
      setGeminiApiKey(settings.geminiApiKey)
      setBedrockAccessKeyId(settings.bedrockAccessKeyId)
      setBedrockSecretAccessKey(settings.bedrockSecretAccessKey)
      setBedrockRegion(settings.bedrockRegion)
      setInitialized(true)
    }
  }, [loading, initialized, settings])

  // Get available models for current provider (Bedrock is region-dependent)
  const availableModels = provider === 'bedrock'
    ? getBedrockModelsForRegion(bedrockRegion)
    : PROVIDER_MODELS[provider]

  // When provider/region changes, auto-select the first model if current model isn't in the list
  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.some(m => m.value === model)) {
      setModel(availableModels[0]!.value)
    }
  }, [provider, bedrockRegion, model, availableModels])

  const currentApiKey = (): string => {
    switch (provider) {
      case 'anthropic': return anthropicApiKey
      case 'openai': return openaiApiKey
      case 'gemini': return geminiApiKey
      default: return ''
    }
  }

  const isConfigured = (): boolean => {
    switch (provider) {
      case 'anthropic': return !!anthropicApiKey.trim()
      case 'openai': return !!openaiApiKey.trim()
      case 'gemini': return !!geminiApiKey.trim()
      case 'bedrock': return !!(bedrockAccessKeyId.trim() && bedrockSecretAccessKey.trim() && bedrockRegion)
    }
  }

  const handleSave = async () => {
    if (!isConfigured()) {
      showToast({ type: 'error', message: '인증 정보를 입력해주세요.' })
      return
    }
    setIsSaving(true)
    try {
      await updateSettings({
        provider,
        model,
        anthropicApiKey: anthropicApiKey.trim(),
        openaiApiKey: openaiApiKey.trim(),
        geminiApiKey: geminiApiKey.trim(),
        bedrockAccessKeyId: bedrockAccessKeyId.trim(),
        bedrockSecretAccessKey: bedrockSecretAccessKey.trim(),
        bedrockRegion,
      })
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

  const apiKeyPlaceholder = (): string => {
    switch (provider) {
      case 'anthropic': return 'sk-ant-...'
      case 'openai': return 'sk-...'
      case 'gemini': return 'AIza...'
      default: return ''
    }
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
        {/* Provider selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">AI 프로바이더</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_PROVIDER_IDS.map(pid => (
              <button
                key={pid}
                onClick={() => setProvider(pid)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  provider === pid
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {PROVIDER_LABELS[pid]}
              </button>
            ))}
          </div>
        </div>

        {/* Credentials — API Key providers */}
        {(provider === 'anthropic' || provider === 'openai' || provider === 'gemini') && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              {PROVIDER_LABELS[provider]} API 키
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentApiKey()}
                onChange={e => {
                  const val = e.target.value
                  if (provider === 'anthropic') setAnthropicApiKey(val)
                  else if (provider === 'openai') setOpenaiApiKey(val)
                  else setGeminiApiKey(val)
                }}
                placeholder={apiKeyPlaceholder()}
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
        )}

        {/* Credentials — AWS Bedrock */}
        {provider === 'bedrock' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Access Key ID</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={bedrockAccessKeyId}
                  onChange={e => setBedrockAccessKeyId(e.target.value)}
                  placeholder="AKIA..."
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Secret Access Key</label>
              <input
                type="password"
                value={bedrockSecretAccessKey}
                onChange={e => setBedrockSecretAccessKey(e.target.value)}
                placeholder="비밀 액세스 키"
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">리전</label>
              <select
                value={bedrockRegion}
                onChange={e => setBedrockRegion(e.target.value)}
                className="input"
              >
                {BEDROCK_REGIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label} ({r.value})</option>
                ))}
              </select>
            </div>

            <p className="text-2xs text-text-tertiary">
              AWS 자격 증명은 로컬에만 저장되며 외부로 전송되지 않습니다.
            </p>
          </div>
        )}

        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">모델</label>
          {availableModels.length === 0 ? (
            <p className="text-sm text-text-tertiary py-2">선택한 리전에서 사용 가능한 모델이 없습니다.</p>
          ) : (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="input"
            >
              {availableModels.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
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

        {/* Persona / Pattern analysis */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">캘린더 패턴 분석</label>
          <p className="text-2xs text-text-tertiary">
            과거 일정을 분석하여 루틴, 선호 시간대, 스케줄링 성향을 파악합니다. AI가 일정을 더 정확하게 배치할 수 있게 됩니다.
          </p>

          {persona && !personaSummary && (
            <div className="rounded-lg bg-surface border border-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-primary">분석 완료</span>
                <span className="text-2xs text-text-tertiary">
                  {new Date(persona.updatedAt).toLocaleDateString('ko-KR')} 기준
                </span>
              </div>
              <div className="text-2xs text-text-secondary space-y-0.5">
                <p>활동: {persona.activeHours.workStart}~{persona.activeHours.workEnd} / 점심: {persona.activeHours.lunchStart}~{persona.activeHours.lunchEnd}</p>
                <p>일일 평균 {persona.avgDailyEvents}개 / 여유 {persona.bufferPreference}분 / 성향: {
                  persona.schedulingStyle === 'conservative' ? '보수적' :
                  persona.schedulingStyle === 'aggressive' ? '공격적' : '보통'
                }</p>
                {persona.routines.length > 0 && (
                  <p>루틴 {persona.routines.length}개 감지됨</p>
                )}
                {persona.notes.length > 0 && (
                  <p className="text-text-tertiary">변화 노트 {persona.notes.length}개</p>
                )}
              </div>
            </div>
          )}

          {personaSummary && (
            <div className="rounded-lg bg-surface border border-accent/30 p-3">
              <pre className="text-2xs text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">{personaSummary}</pre>
            </div>
          )}

          {personaError && (
            <p className="text-2xs text-error">{personaError}</p>
          )}

          <button
            onClick={runSetup}
            disabled={personaLoading}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              personaLoading
                ? 'bg-surface border border-border text-text-tertiary cursor-wait'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover hover:border-accent/50'
            }`}
          >
            {personaLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
                분석 중...
              </span>
            ) : persona ? '재분석' : '내 캘린더 패턴 분석하기'}
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary w-full"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="btn-ghost w-full text-sm text-text-tertiary hover:text-error"
          >
            Google 로그아웃
          </button>
        )}
      </div>
    </div>
  )
}
