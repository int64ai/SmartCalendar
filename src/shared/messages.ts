/** Message protocol between Side Panel and Service Worker */

import type { ProviderId } from '../api/providers/types';
import type { UserPersona } from './types';

// Side Panel -> Service Worker
export type PanelToSWMessage =
  | { type: 'CHAT_REQUEST'; payload: { message: string; calendarContext?: { viewing_date: string; view_type: string } } }
  | { type: 'CHAT_CANCEL' }
  | { type: 'CHAT_CLEAR' }
  | { type: 'SETTINGS_UPDATE'; payload: {
      provider?: ProviderId;
      model?: string;
      theme?: string;
      anthropicApiKey?: string;
      openaiApiKey?: string;
      geminiApiKey?: string;
      bedrockAccessKeyId?: string;
      bedrockSecretAccessKey?: string;
      bedrockRegion?: string;
    } }
  | { type: 'GET_SETTINGS' }
  | { type: 'GOOGLE_SIGN_IN' }
  | { type: 'GOOGLE_SIGN_OUT' }
  | { type: 'GOOGLE_AUTH_CHECK' }
  | { type: 'GOOGLE_FETCH_EVENTS'; payload: { timeMin: string; timeMax: string } }
  | { type: 'PERSONA_SETUP' }
  | { type: 'PERSONA_GET' };

// Service Worker -> Side Panel
export type SWToPanelMessage =
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; payload: { content: string } }
  | { type: 'STREAM_TOOL'; payload: { name: string } }
  | { type: 'STREAM_DONE'; payload: { fullText: string } }
  | { type: 'STREAM_ERROR'; payload: { error: string } }
  | { type: 'EVENTS_CHANGED' }
  | { type: 'SETTINGS_DATA'; payload: {
      provider: ProviderId;
      model: string;
      theme: string;
      anthropicApiKey: string;
      openaiApiKey: string;
      geminiApiKey: string;
      bedrockAccessKeyId: string;
      bedrockSecretAccessKey: string;
      bedrockRegion: string;
    } }
  | { type: 'GOOGLE_AUTH_RESULT'; payload: { signedIn: boolean; error?: string } }
  | { type: 'GOOGLE_EVENTS_RESULT'; payload: { events: Array<{ id: string; title: string; start: string; end: string; description?: string; location?: string }> } }
  | { type: 'PERSONA_RESULT'; payload: { persona: UserPersona; summary: string } }
  | { type: 'PERSONA_DATA'; payload: { persona: UserPersona | null } }
  | { type: 'PERSONA_ERROR'; payload: { error: string } };
