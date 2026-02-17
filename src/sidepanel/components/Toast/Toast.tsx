import { useEffect, useState } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ToastItem } from './ToastProvider'

interface ToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

const ICONS = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
}

const COLORS = {
  success: 'border-l-green-500 bg-green-500/10',
  error: 'border-l-red-500 bg-red-500/10',
  info: 'border-l-blue-500 bg-blue-500/10',
  warning: 'border-l-yellow-500 bg-yellow-500/10',
}

const ICON_COLORS = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const duration = toast.duration ?? 4000

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))

    const timer = setTimeout(() => {
      handleDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      onDismiss(toast.id)
    }, 200)
  }

  const Icon = ICONS[toast.type]

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 border border-border
        bg-surface shadow-lg backdrop-blur-sm min-w-[300px] max-w-[420px]
        transition-all duration-200 ease-out
        ${COLORS[toast.type]}
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${ICON_COLORS[toast.type]}`} />
      <span className="text-sm text-text-primary flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            handleDismiss()
          }}
          className="text-sm font-medium text-accent hover:text-accent-hover transition-colors whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded hover:bg-surface-hover transition-colors flex-shrink-0"
      >
        <XMarkIcon className="w-4 h-4 text-text-secondary" />
      </button>
    </div>
  )
}
