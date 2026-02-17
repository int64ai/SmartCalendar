/** Anthropic Messages API client */

import type { AnthropicMessage, AnthropicResponse, AnthropicToolDef } from './message-types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

export async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: AnthropicMessage[],
  tools?: AnthropicToolDef[],
  signal?: AbortSignal,
): Promise<AnthropicResponse> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
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

  return (await res.json()) as AnthropicResponse;
}
