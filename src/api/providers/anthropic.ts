/** Anthropic Messages API provider */

import type {
  AIProvider,
  ChatMessage,
  ChatContent,
  ChatResponse,
  ToolDef,
  AnthropicCredentials,
} from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

export class AnthropicProvider implements AIProvider {
  private apiKey: string;

  constructor(credentials: AnthropicCredentials) {
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
      system: params.system,
      messages: params.messages,
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools;
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401) {
        throw new Error('API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
      } else if (status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (status === 529 || status === 503) {
        throw new Error('Anthropic 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
      } else {
        throw new Error(`API 오류가 발생했습니다 (${status}). 다시 시도해주세요.`);
      }
    }

    const data = await res.json();

    return {
      content: data.content as ChatContent[],
      stopReason: data.stop_reason as ChatResponse['stopReason'],
      usage: data.usage
        ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
        : undefined,
    };
  }
}
