/** Chrome Extension Service Worker */

import type { ChatMessage } from '../api/providers/types';
import type { PanelToSWMessage, SWToPanelMessage } from '../shared/messages';
import type { StorageData } from '../shared/storage';
import { getStorage, setStorage, getPersona } from '../shared/storage';
import { getSystemPrompt } from '../api/system-prompt';
import { runToolUseLoop } from '../api/tool-use-loop';
import { createProvider, isProviderConfigured } from '../api/providers/index';
import type { ProviderCredentials } from '../api/providers/types';
import { TOOL_DEFINITIONS, executeTool } from '../tools/index';
import { GoogleCalendar } from '../data/google-calendar';
import { MAX_MESSAGES } from '../shared/constants';
import * as gcalApi from '../api/google-calendar';
import { analyzeUserPatterns, detectDrift } from '../tools/persona';

// Open side panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Conversation history (in-memory, lost on SW restart)
let conversationMessages: ChatMessage[] = [];

// Abort controller for cancellation
let currentAbortController: AbortController | null = null;

// Processing guard to prevent concurrent requests
let isProcessing = false;

// Singleton Google Calendar instance
const calendar = new GoogleCalendar();

function sendToPanel(msg: SWToPanelMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Panel may not be open; ignore
  });
}

function buildProviderCredentials(storage: StorageData): ProviderCredentials {
  switch (storage.provider) {
    case 'anthropic':
      return { provider: 'anthropic', credentials: { apiKey: storage.anthropicApiKey } };
    case 'openai':
      return { provider: 'openai', credentials: { apiKey: storage.openaiApiKey } };
    case 'gemini':
      return { provider: 'gemini', credentials: { apiKey: storage.geminiApiKey } };
    case 'bedrock':
      return {
        provider: 'bedrock',
        credentials: {
          accessKeyId: storage.bedrockAccessKeyId,
          secretAccessKey: storage.bedrockSecretAccessKey,
          region: storage.bedrockRegion,
        },
      };
  }
}

const MAX_MESSAGE_LENGTH = 4000;

async function handleChatRequest(
  payload: { message: string; calendarContext?: { viewing_date: string; view_type: string } },
): Promise<void> {
  // Prevent concurrent requests
  if (isProcessing) {
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: '이전 요청을 처리 중입니다. 잠시 기다려주세요.' } });
    return;
  }

  // Validate message length
  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: `메시지가 너무 깁니다 (최대 ${MAX_MESSAGE_LENGTH}자).` } });
    return;
  }

  // Get settings
  const storage = await getStorage();
  const providerConfig = buildProviderCredentials(storage);

  if (!isProviderConfigured(providerConfig)) {
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: 'AI 프로바이더가 설정되지 않았습니다. 설정에서 인증 정보를 입력해주세요.' } });
    return;
  }

  // Check Google sign-in
  const signedIn = await gcalApi.isSignedIn();
  if (!signedIn) {
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: 'Google Calendar에 로그인되어 있지 않습니다. 먼저 로그인해주세요.' } });
    return;
  }

  isProcessing = true;

  // Signal start
  sendToPanel({ type: 'STREAM_START' });

  // Add user message
  conversationMessages.push({
    role: 'user',
    content: [{ type: 'text', text: payload.message }],
  });

  // Trim conversation (count only user/assistant text turns, not tool intermediates)
  if (conversationMessages.length > MAX_MESSAGES) {
    conversationMessages = conversationMessages.slice(-MAX_MESSAGES);
  }

  // Build system prompt (with persona if available)
  const persona = await getPersona();
  const systemPrompt = getSystemPrompt(payload.calendarContext, persona);

  // Create abort controller
  currentAbortController = new AbortController();

  // Tool definitions
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Record<string, unknown>,
  }));

  try {
    const provider = createProvider(providerConfig);

    // Pass a COPY so tool-use intermediates don't pollute our conversation history
    const loopMessages = [...conversationMessages];

    const result = await runToolUseLoop(
      provider,
      storage.model,
      systemPrompt,
      loopMessages,
      tools,
      async (name, args) => {
        const toolResult = await executeTool(name, args, calendar);
        // Notify panel to refetch calendar if a mutation tool was called
        if (['create_event', 'update_event', 'delete_event', 'undo_event'].includes(name)) {
          sendToPanel({ type: 'EVENTS_CHANGED' } as SWToPanelMessage);

          // Async drift detection for create/update (non-blocking)
          if ((name === 'create_event' || name === 'update_event') && args.title && args.start && args.end) {
            detectDrift({
              title: args.title as string,
              start: args.start as string,
              end: args.end as string,
            }).catch(() => { /* drift detection is best-effort */ });
          }
        }
        return toolResult;
      },
      (toolName) => {
        sendToPanel({ type: 'STREAM_TOOL', payload: { name: toolName } });
      },
      currentAbortController.signal,
    );

    // Only store the final text response (not tool intermediates) in conversation history
    conversationMessages.push({
      role: 'assistant',
      content: [{ type: 'text', text: result.text }],
    });

    // Trim conversation
    if (conversationMessages.length > MAX_MESSAGES) {
      conversationMessages = conversationMessages.slice(-MAX_MESSAGES);
    }

    sendToPanel({ type: 'STREAM_DONE', payload: { fullText: result.text } });
  } catch (err) {
    // Remove the orphaned user message since no assistant response follows it
    // (prevents alternating-role violations on subsequent requests)
    if (conversationMessages.length > 0 && conversationMessages[conversationMessages.length - 1]?.role === 'user') {
      conversationMessages.pop();
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      sendToPanel({ type: 'STREAM_ERROR', payload: { error: '요청이 취소되었습니다.' } });
    } else {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = errorMessage.length > 200
        ? errorMessage.slice(0, 200) + '...'
        : errorMessage;
      sendToPanel({ type: 'STREAM_ERROR', payload: { error: safeMessage } });
    }
  } finally {
    currentAbortController = null;
    isProcessing = false;
  }
}

function handleCancel(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

async function handleGetSettings(sendResponse: (response: unknown) => void): Promise<void> {
  const data = await getStorage();
  sendToPanel({
    type: 'SETTINGS_DATA',
    payload: {
      provider: data.provider,
      model: data.model,
      theme: data.theme,
      anthropicApiKey: data.anthropicApiKey,
      openaiApiKey: data.openaiApiKey,
      geminiApiKey: data.geminiApiKey,
      bedrockAccessKeyId: data.bedrockAccessKeyId,
      bedrockSecretAccessKey: data.bedrockSecretAccessKey,
      bedrockRegion: data.bedrockRegion,
    },
  });
  sendResponse({ ok: true });
}

async function handleSettingsUpdate(payload: Record<string, unknown>): Promise<void> {
  const allowedKeys: Array<keyof StorageData> = [
    'provider', 'model', 'theme',
    'anthropicApiKey', 'openaiApiKey', 'geminiApiKey',
    'bedrockAccessKeyId', 'bedrockSecretAccessKey', 'bedrockRegion',
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (payload[key] !== undefined) {
      update[key] = payload[key];
    }
  }
  await setStorage(update as Partial<StorageData>);
}

async function handleGoogleSignIn(): Promise<void> {
  try {
    await gcalApi.getAuthToken(true);
    await setStorage({ googleSignedIn: true });
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn: false, error: msg } });
  }
}

async function handleGoogleSignOut(): Promise<void> {
  try {
    await gcalApi.revokeAuthToken();
    await setStorage({ googleSignedIn: false });
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn: false } });
  } catch {
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn: false } });
  }
}

async function handleGoogleAuthCheck(): Promise<void> {
  try {
    const signedIn = await gcalApi.isSignedIn();
    await setStorage({ googleSignedIn: signedIn });
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn } });
  } catch {
    sendToPanel({ type: 'GOOGLE_AUTH_RESULT', payload: { signedIn: false } });
  }
}

async function handleGoogleFetchEvents(payload: { timeMin: string; timeMax: string }): Promise<void> {
  try {
    const items = await gcalApi.listEvents('primary', payload.timeMin, payload.timeMax);
    const events = items
      .filter(g => g.status !== 'cancelled')
      .map(g => ({
        id: g.id,
        title: g.summary ?? '(제목 없음)',
        start: g.start.dateTime ?? `${g.start.date}T00:00:00`,
        end: g.end.dateTime ?? `${g.end.date}T23:59:59`,
        description: g.description,
        location: g.location,
      }));
    sendToPanel({ type: 'GOOGLE_EVENTS_RESULT', payload: { events } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: `일정 불러오기 실패: ${msg}` } });
  }
}

async function handlePersonaSetup(): Promise<void> {
  try {
    const signedIn = await gcalApi.isSignedIn();
    if (!signedIn) {
      sendToPanel({ type: 'PERSONA_ERROR', payload: { error: 'Google Calendar에 로그인되어 있지 않습니다.' } });
      return;
    }
    const { persona, summary } = await analyzeUserPatterns(calendar);
    sendToPanel({ type: 'PERSONA_RESULT', payload: { persona, summary } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendToPanel({ type: 'PERSONA_ERROR', payload: { error: msg } });
  }
}

async function handlePersonaGet(): Promise<void> {
  const persona = await getPersona();
  sendToPanel({ type: 'PERSONA_DATA', payload: { persona } });
}

// Message listener
chrome.runtime.onMessage.addListener(
  (message: PanelToSWMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'CHAT_REQUEST':
        handleChatRequest(message.payload);
        break;
      case 'CHAT_CANCEL':
        handleCancel();
        break;
      case 'CHAT_CLEAR':
        conversationMessages = [];
        break;
      case 'GET_SETTINGS':
        handleGetSettings(sendResponse);
        return true; // async response
      case 'SETTINGS_UPDATE':
        handleSettingsUpdate(message.payload as unknown as Record<string, unknown>);
        break;
      case 'GOOGLE_SIGN_IN':
        handleGoogleSignIn();
        break;
      case 'GOOGLE_SIGN_OUT':
        handleGoogleSignOut();
        break;
      case 'GOOGLE_AUTH_CHECK':
        handleGoogleAuthCheck();
        break;
      case 'GOOGLE_FETCH_EVENTS':
        handleGoogleFetchEvents(message.payload);
        break;
      case 'PERSONA_SETUP':
        handlePersonaSetup();
        break;
      case 'PERSONA_GET':
        handlePersonaGet();
        break;
    }
    sendResponse({ ok: true });
    return true;
  },
);
