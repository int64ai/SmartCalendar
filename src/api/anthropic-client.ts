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
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as AnthropicResponse;
}
