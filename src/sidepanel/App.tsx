import { useState } from 'react'
import ChatPanel from './components/ChatPanel'
import SettingsPage from './components/SettingsPage'
import ToastProvider from './components/Toast/ToastProvider'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'

export default function App() {
  const [page, setPage] = useState<'chat' | 'settings'>('chat')
  useTheme()  // apply theme on mount
  const { settings } = useSettings()

  // If no API key, show settings first
  const activePage = !settings.apiKey ? 'settings' : page

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-background">
        {activePage === 'settings' ? (
          <SettingsPage onBack={() => setPage('chat')} showBackButton={!!settings.apiKey} />
        ) : (
          <ChatPanel onOpenSettings={() => setPage('settings')} />
        )}
      </div>
    </ToastProvider>
  )
}
