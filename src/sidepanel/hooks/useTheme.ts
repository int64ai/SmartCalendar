import { useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'system'

const THEME_KEY = 'smartcalendar_theme'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }
}

export function useTheme() {
  // Use localStorage for sync initial render, chrome.storage.local as source of truth
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
  })

  // Sync from chrome.storage.local on mount
  useEffect(() => {
    chrome.storage.local.get({ theme: 'dark' }, (data) => {
      const stored = data.theme as Theme
      if (stored !== theme) {
        setThemeState(stored)
        localStorage.setItem(THEME_KEY, stored)
        applyTheme(stored)
      }
    })

    // Listen for chrome.storage changes (e.g. from other contexts)
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.theme?.newValue) {
        const newTheme = changes.theme.newValue as Theme
        setThemeState(newTheme)
        localStorage.setItem(THEME_KEY, newTheme)
        applyTheme(newTheme)
      }
    }
    chrome.storage.local.onChanged.addListener(storageListener)
    return () => chrome.storage.local.onChanged.removeListener(storageListener)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_KEY, newTheme)
    chrome.storage.local.set({ theme: newTheme })
    applyTheme(newTheme)
  }, [])

  // Apply on mount and listen for system changes
  useEffect(() => {
    applyTheme(theme)

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
  }, [theme])

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  return { theme, setTheme, resolvedTheme }
}
