import { useState, useEffect, useCallback } from 'react'

interface GoogleAuthState {
  signedIn: boolean
  loading: boolean
  error: string | null
}

export function useGoogleAuth() {
  const [state, setState] = useState<GoogleAuthState>({
    signedIn: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const listener = (msg: { type: string; payload?: Record<string, unknown> }) => {
      if (msg.type === 'GOOGLE_AUTH_RESULT') {
        setState({
          signedIn: !!msg.payload?.signedIn,
          loading: false,
          error: (msg.payload?.error as string) ?? null,
        })
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    // Check auth status on mount
    chrome.runtime.sendMessage({ type: 'GOOGLE_AUTH_CHECK' }).catch(() => {
      setState({ signedIn: false, loading: false, error: null })
    })

    // Also check from storage
    chrome.storage.local.get({ googleSignedIn: false }, (data) => {
      if (data.googleSignedIn) {
        setState(prev => ({ ...prev, signedIn: true, loading: false }))
      }
    })

    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const signIn = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    chrome.runtime.sendMessage({ type: 'GOOGLE_SIGN_IN' }).catch(() => {
      setState(prev => ({ ...prev, loading: false, error: 'Google 로그인 요청에 실패했습니다.' }))
    })
  }, [])

  const signOut = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    chrome.runtime.sendMessage({ type: 'GOOGLE_SIGN_OUT' }).catch(() => {
      setState(prev => ({ ...prev, loading: false, signedIn: false }))
    })
  }, [])

  return { ...state, signIn, signOut }
}
