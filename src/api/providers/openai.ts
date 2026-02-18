/** OpenAI Chat Completions API provider */

import type {
  AIProvider,
  ChatMessage,
  ChatContent,
  ChatResponse,
  ToolDef,
  OpenAICredentials,
} from './types';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_TOKENS = 4096;

// ─── OpenAI-specific types ──────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// ─── Format converters ──────────────────────────────────────────────

function toOpenAIMessages(system: string, messages: ChatMessage[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [{ role: 'system', content: system }];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const textParts = msg.content.filter((c) => c.type === 'text') as Array<{ type: 'text'; text: string }>;
      const toolResults = msg.content.filter((c) => c.type === 'tool_result') as Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }>;

      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          result.push({
            role: 'tool',
            content: tr.content,
            tool_call_id: tr.tool_use_id,
          });
        }
      } else {
        result.push({
          role: 'user',
          content: textParts.map((t) => t.text).join('\n') || '',
        });
      }
    } else {
      const textParts = msg.content.filter((c) => c.type === 'text') as Array<{ type: 'text'; text: string }>;
      const toolUses = msg.content.filter((c) => c.type === 'tool_use') as Array<{
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;

      const oaiMsg: OpenAIMessage = {
        role: 'assistant',
        content: textParts.map((t) => t.text).join('\n') || null,
      };

      if (toolUses.length > 0) {
        oaiMsg.tool_calls = toolUses.map((tu) => ({
          id: tu.id,
          type: 'function' as const,
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input),
          },
        }));
      }

      result.push(oaiMsg);
    }
  }

  return result;
}

function toOpenAITools(tools: ToolDef[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function fromOpenAIResponse(data: Record<string, unknown>): ChatResponse {
  const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
  if (!choice) {
    return { content: [{ type: 'text', text: '응답을 생성할 수 없습니다.' }], stopReason: 'end_turn' };
  }

  const message = choice.message as OpenAIMessage;
  const content: ChatContent[] = [];

  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }

  const finishReason = choice.finish_reason as string;
  let stopReason: ChatResponse['stopReason'] = 'end_turn';

  if (finishReason === 'tool_calls' && message.tool_calls) {
    stopReason = 'tool_use';
    for (const tc of message.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = {};
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  } else if (finishReason === 'length') {
    stopReason = 'max_tokens';
  }

  const usage = data.usage as Record<string, number> | undefined;

  return {
    content,
    stopReason,
    usage: usage
      ? { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 }
      : undefined,
  };
}

// ─── Provider class ─────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  private apiKey: string;

  constructor(credentials: OpenAICredentials) {
    this.apiKey = credentials.apiKey;
  }

  async chat(params: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: params.model,
      max_tokens: MAX_TOKENS,
      messages: toOpenAIMessages(params.system, params.messages),
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = toOpenAITools(params.tools);
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401) {
        throw new Error('OpenAI API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
      } else if (status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (status === 503) {
        throw new Error('OpenAI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
      } else {
        throw new Error(`OpenAI API 오류가 발생했습니다 (${status}). 다시 시도해주세요.`);
      }
    }

    const data = await res.json();
    return fromOpenAIResponse(data);
  }
}
