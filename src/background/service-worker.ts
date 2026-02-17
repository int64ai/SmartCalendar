/** Chrome Extension Service Worker */

import type { AnthropicMessage } from '../api/message-types';
import type { PanelToSWMessage, SWToPanelMessage } from '../shared/messages';
import { getStorage, setStorage } from '../shared/storage';
import { getSystemPrompt } from '../api/system-prompt';
import { runToolUseLoop } from '../api/tool-use-loop';
import { TOOL_DEFINITIONS, executeTool } from '../tools/index';
import { DexieCalendar } from '../data/calendar';
import { MAX_MESSAGES } from '../shared/constants';

// Open side panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Conversation history (in-memory, lost on SW restart)
let conversationMessages: AnthropicMessage[] = [];

// Abort controller for cancellation
let currentAbortController: AbortController | null = null;

// Singleton calendar instance
const calendar = new DexieCalendar();

function sendToPanel(msg: SWToPanelMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Panel may not be open; ignore
  });
}

async function handleChatRequest(
  payload: { message: string; calendarContext?: { viewing_date: string; view_type: string } },
): Promise<void> {
  // Get settings
  const { apiKey, model } = await getStorage();

  if (!apiKey) {
    sendToPanel({ type: 'STREAM_ERROR', payload: { error: 'API 키가 설정되지 않았습니다. 설정에서 Anthropic API 키를 입력해주세요.' } });
    return;
  }

  // Signal start
  sendToPanel({ type: 'STREAM_START' });

  // Add user message
  conversationMessages.push({
    role: 'user',
    content: [{ type: 'text', text: payload.message }],
  });

  // Trim conversation
  if (conversationMessages.length > MAX_MESSAGES) {
    conversationMessages = conversationMessages.slice(-MAX_MESSAGES);
  }

  // Build system prompt
  const systemPrompt = getSystemPrompt(payload.calendarContext);

  // Create abort controller
  currentAbortController = new AbortController();

  // Tool definitions are compatible with AnthropicToolDef
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Record<string, unknown>,
  }));

  try {
    const result = await runToolUseLoop(
      apiKey,
      model,
      systemPrompt,
      conversationMessages,
      tools,
      async (name, args) => executeTool(name, args, calendar),
      (toolName) => {
        sendToPanel({ type: 'STREAM_TOOL', payload: { name: toolName } });
      },
      currentAbortController.signal,
    );

    // Add assistant response to history
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
    if (err instanceof DOMException && err.name === 'AbortError') {
      sendToPanel({ type: 'STREAM_ERROR', payload: { error: '요청이 취소되었습니다.' } });
    } else {
      const errorMessage = err instanceof Error ? err.message : String(err);
      sendToPanel({ type: 'STREAM_ERROR', payload: { error: errorMessage } });
    }
  } finally {
    currentAbortController = null;
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
    payload: { apiKey: data.apiKey, model: data.model, theme: data.theme },
  });
  sendResponse({ ok: true });
}

async function handleSettingsUpdate(payload: { apiKey?: string; model?: string; theme?: string }): Promise<void> {
  const update: Record<string, string> = {};
  if (payload.apiKey !== undefined) update.apiKey = payload.apiKey;
  if (payload.model !== undefined) update.model = payload.model;
  if (payload.theme !== undefined) update.theme = payload.theme;
  await setStorage(update);
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
        handleSettingsUpdate(message.payload);
        break;
    }
    sendResponse({ ok: true });
    return true;
  },
);
