import { useState, useEffect, useCallback } from 'react'
import type { ProviderId } from '../../api/providers/types'

export interface Settings {
  provider: ProviderId
  model: string
  theme: 'dark' | 'light' | 'system'
  anthropicApiKey: string
  openaiApiKey: string
  geminiApiKey: string
  bedrockAccessKeyId: string
  bedrockSecretAccessKey: string
  bedrockRegion: string
}

const DEFAULTS: Settings = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  theme: 'dark',
  anthropicApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  bedrockAccessKeyId: '',
  bedrockSecretAccessKey: '',
  bedrockRegion: 'us-east-1',
}

/** Check if the current provider has valid credentials */
export function isSettingsConfigured(s: Settings): boolean {
  switch (s.provider) {
    case 'anthropic': return !!s.anthropicApiKey
    case 'openai': return !!s.openaiApiKey
    case 'gemini': return !!s.geminiApiKey
    case 'bedrock': return !!(s.bedrockAccessKeyId && s.bedrockSecretAccessKey && s.bedrockRegion)
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.storage.local.get(DEFAULTS, (data) => {
      setSettings(data as Settings)
      setLoading(false)
    })
    // Listen for changes
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      setSettings(prev => {
        const updated = { ...prev }
        for (const [key, change] of Object.entries(changes)) {
          if (key in updated) (updated as Record<string, unknown>)[key] = change.newValue
        }
        return updated as Settings
      })
    }
    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [])

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    await chrome.storage.local.set(partial)
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return { settings, updateSettings, loading }
}
