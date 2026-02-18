/** Google Gemini API provider */

import type {
  AIProvider,
  ChatMessage,
  ChatContent,
  ChatResponse,
  ToolDef,
  GeminiCredentials,
} from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Gemini-specific types ──────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string; is_error?: boolean } } };

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ─── Format converters ──────────────────────────────────────────────

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const result: GeminiContent[] = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    for (const c of msg.content) {
      if (c.type === 'text') {
        parts.push({ text: c.text });
      } else if (c.type === 'tool_use') {
        parts.push({
          functionCall: { name: c.name, args: c.input },
        });
      } else if (c.type === 'tool_result') {
        parts.push({
          functionResponse: {
            name: c.tool_use_id,
            response: { content: c.content, is_error: c.is_error },
          },
        });
      }
    }

    result.push({ role, parts });
  }

  return result;
}

function toGeminiTools(tools: ToolDef[]): { functionDeclarations: GeminiFunctionDeclaration[] } {
  return {
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    })),
  };
}

function fromGeminiResponse(data: Record<string, unknown>): ChatResponse {
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) {
    return { content: [{ type: 'text', text: '응답을 생성할 수 없습니다.' }], stopReason: 'end_turn' };
  }

  const candidate = candidates[0] as Record<string, unknown> | undefined;
  if (!candidate) {
    return { content: [{ type: 'text', text: '응답을 생성할 수 없습니다.' }], stopReason: 'end_turn' };
  }
  const geminiContent = candidate.content as GeminiContent | undefined;
  const finishReason = candidate.finishReason as string | undefined;

  const content: ChatContent[] = [];
  let hasToolUse = false;

  if (geminiContent?.parts) {
    for (const part of geminiContent.parts) {
      if ('text' in part) {
        content.push({ type: 'text', text: part.text });
      } else if ('functionCall' in part) {
        hasToolUse = true;
        const toolId = `toolu_gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        content.push({
          type: 'tool_use',
          id: toolId,
          name: part.functionCall.name,
          input: part.functionCall.args,
        });
      }
    }
  }

  let stopReason: ChatResponse['stopReason'] = 'end_turn';
  if (hasToolUse) {
    stopReason = 'tool_use';
  } else if (finishReason === 'MAX_TOKENS') {
    stopReason = 'max_tokens';
  }

  const usageMeta = data.usageMetadata as Record<string, number> | undefined;

  return {
    content,
    stopReason,
    usage: usageMeta
      ? { inputTokens: usageMeta.promptTokenCount ?? 0, outputTokens: usageMeta.candidatesTokenCount ?? 0 }
      : undefined,
  };
}

// ─── Provider class ─────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private apiKey: string;

  constructor(credentials: GeminiCredentials) {
    this.apiKey = credentials.apiKey;
  }

  async chat(params: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
    const url = `${API_BASE}/${params.model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: toGeminiContents(params.messages),
      systemInstruction: { parts: [{ text: params.system }] },
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = [toGeminiTools(params.tools)];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 400) {
        throw new Error('Gemini API 요청이 잘못되었습니다. 모델명을 확인해주세요.');
      } else if (status === 403) {
        throw new Error('Gemini API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
      } else if (status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (status === 503) {
        throw new Error('Gemini 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
      } else {
        throw new Error(`Gemini API 오류가 발생했습니다 (${status}). 다시 시도해주세요.`);
      }
    }

    const data = await res.json();
    return fromGeminiResponse(data);
  }
}
