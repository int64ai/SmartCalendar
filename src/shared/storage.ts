/** Chrome storage wrapper */

import type { ProviderId } from '../api/providers/types';
import type { UserPersona } from './types';

export interface StorageData {
  provider: ProviderId;
  model: string;
  theme: 'dark' | 'light' | 'system';
  // Per-provider credentials (stored separately so switching providers keeps keys)
  anthropicApiKey: string;
  openaiApiKey: string;
  geminiApiKey: string;
  bedrockAccessKeyId: string;
  bedrockSecretAccessKey: string;
  bedrockRegion: string;
  // Google Calendar
  googleSignedIn: boolean;
  // User persona (null until initial setup)
  userPersona: UserPersona | null;
}

const DEFAULTS: StorageData = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  theme: 'dark',
  anthropicApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  bedrockAccessKeyId: '',
  bedrockSecretAccessKey: '',
  bedrockRegion: 'us-east-1',
  googleSignedIn: false,
  userPersona: null,
};

export async function getStorage(): Promise<StorageData> {
  // Read raw data including the legacy 'apiKey' field
  const result = await chrome.storage.local.get({ ...DEFAULTS, apiKey: '' });

  // Migrate legacy 'apiKey' -> 'anthropicApiKey' (from before multi-provider support)
  const legacy = result as StorageData & { apiKey?: string };
  if (legacy.apiKey && !legacy.anthropicApiKey) {
    legacy.anthropicApiKey = legacy.apiKey;
    await chrome.storage.local.set({ anthropicApiKey: legacy.apiKey });
    await chrome.storage.local.remove('apiKey');
  }
  delete legacy.apiKey;

  // Migrate invalid Bedrock model IDs (direct model IDs no longer work; need inference profile IDs)
  if (legacy.provider === 'bedrock' && legacy.model && !legacy.model.includes('.anthropic.')) {
    // Old direct model ID like "anthropic.claude-opus-4-6-v1" -> pick a Global inference profile
    const fallback = `global.anthropic.claude-sonnet-4-6`;
    legacy.model = fallback;
    await chrome.storage.local.set({ model: fallback });
  }

  return legacy as StorageData;
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

export async function getPersona(): Promise<UserPersona | null> {
  const { userPersona } = await chrome.storage.local.get({ userPersona: null });
  return userPersona as UserPersona | null;
}

export async function setPersona(persona: UserPersona): Promise<void> {
  await chrome.storage.local.set({ userPersona: persona });
}
