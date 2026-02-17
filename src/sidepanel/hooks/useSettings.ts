import { useState, useEffect, useCallback } from 'react'

export interface Settings {
  apiKey: string
  model: string
  theme: 'dark' | 'light' | 'system'
}

const DEFAULTS: Settings = { apiKey: '', model: 'claude-sonnet-4-20250514', theme: 'dark' }

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
