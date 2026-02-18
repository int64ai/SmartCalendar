import { useState, useEffect, useCallback } from 'react';
import type { UserPersona } from '../../shared/types';

export function usePersona() {
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    const listener = (msg: { type: string; payload?: Record<string, unknown> }) => {
      switch (msg.type) {
        case 'PERSONA_RESULT': {
          const p = msg.payload as { persona: UserPersona; summary: string };
          setPersona(p.persona);
          setSummary(p.summary);
          setLoading(false);
          setError(null);
          break;
        }
        case 'PERSONA_DATA': {
          const p = msg.payload as { persona: UserPersona | null };
          setPersona(p.persona);
          setSummary(null);
          setLoading(false);
          break;
        }
        case 'PERSONA_ERROR': {
          const p = msg.payload as { error: string };
          setError(p.error);
          setLoading(false);
          break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    chrome.runtime.sendMessage({ type: 'PERSONA_GET' }).catch(() => {});
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const runSetup = useCallback(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    chrome.runtime.sendMessage({ type: 'PERSONA_SETUP' }).catch(() => {
      setError('서비스 워커와 통신할 수 없습니다.');
      setLoading(false);
    });
  }, []);

  return { persona, loading, error, summary, runSetup };
}
