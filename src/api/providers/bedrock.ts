/** AWS Bedrock Converse API provider (using aws4fetch for SigV4 signing) */

import type {
  AIProvider,
  ChatMessage,
  ChatContent,
  ChatResponse,
  ToolDef,
  BedrockCredentials,
} from './types';

const MAX_TOKENS = 4096;

// ─── Bedrock-specific types ─────────────────────────────────────────

interface BedrockContentBlock {
  text?: string;
  toolUse?: { toolUseId: string; name: string; input: Record<string, unknown> };
  toolResult?: { toolUseId: string; content: Array<{ text: string }>; status?: 'success' | 'error' };
}

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: BedrockContentBlock[];
}

// ─── Format converters ──────────────────────────────────────────────

function toBedrockMessages(messages: ChatMessage[]): BedrockMessage[] {
  return messages.map((msg) => {
    const blocks: BedrockContentBlock[] = [];

    for (const c of msg.content) {
      if (c.type === 'text') {
        blocks.push({ text: c.text });
      } else if (c.type === 'tool_use') {
        blocks.push({
          toolUse: { toolUseId: c.id, name: c.name, input: c.input },
        });
      } else if (c.type === 'tool_result') {
        blocks.push({
          toolResult: {
            toolUseId: c.tool_use_id,
            content: [{ text: c.content }],
            status: c.is_error ? 'error' : 'success',
          },
        });
      }
    }

    return { role: msg.role, content: blocks };
  });
}

function toBedrockTools(tools: ToolDef[]): Array<{ toolSpec: { name: string; description: string; inputSchema: { json: Record<string, unknown> } } }> {
  return tools.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.input_schema },
    },
  }));
}

function fromBedrockResponse(data: Record<string, unknown>): ChatResponse {
  const output = data.output as { message?: BedrockMessage } | undefined;
  const stopReason = data.stopReason as string | undefined;
  const usage = data.usage as { inputTokens?: number; outputTokens?: number } | undefined;

  const content: ChatContent[] = [];

  if (output?.message?.content) {
    for (const block of output.message.content) {
      if (block.text) {
        content.push({ type: 'text', text: block.text });
      } else if (block.toolUse) {
        content.push({
          type: 'tool_use',
          id: block.toolUse.toolUseId,
          name: block.toolUse.name,
          input: block.toolUse.input,
        });
      }
    }
  }

  let mappedStopReason: ChatResponse['stopReason'] = 'end_turn';
  if (stopReason === 'tool_use') {
    mappedStopReason = 'tool_use';
  } else if (stopReason === 'max_tokens') {
    mappedStopReason = 'max_tokens';
  }

  return {
    content: content.length > 0
      ? content
      : [{ type: 'text', text: '응답을 생성할 수 없습니다.' }],
    stopReason: mappedStopReason,
    usage: usage
      ? { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 }
      : undefined,
  };
}

// ─── SigV4 signing utilities ────────────────────────────────────────

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  let key = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey).buffer as ArrayBuffer, dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  key = await hmacSha256(key, 'aws4_request');
  return key;
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string,
  credentials: { accessKeyId: string; secretAccessKey: string; region: string },
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url);
  const service = 'bedrock';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256(body);

  const signedHeaders: Record<string, string> = {
    ...headers,
    host: parsedUrl.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const headerKeys = Object.keys(signedHeaders).sort();
  const signedHeaderStr = headerKeys.join(';');
  const canonicalHeaders = headerKeys.map((k) => `${k}:${signedHeaders[k]}\n`).join('');

  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.search.slice(1),
    canonicalHeaders,
    signedHeaderStr,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(credentials.secretAccessKey, dateStamp, credentials.region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderStr}, Signature=${signature}`;

  return {
    ...signedHeaders,
    Authorization: authorization,
  };
}

// ─── Provider class ─────────────────────────────────────────────────

export class BedrockProvider implements AIProvider {
  private credentials: BedrockCredentials;

  constructor(credentials: BedrockCredentials) {
    this.credentials = credentials;
  }

  async chat(params: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
    const region = this.credentials.region;
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(params.model)}/converse`;

    const body: Record<string, unknown> = {
      messages: toBedrockMessages(params.messages),
      system: [{ text: params.system }],
      inferenceConfig: { maxTokens: MAX_TOKENS },
    };

    if (params.tools && params.tools.length > 0) {
      body.toolConfig = { tools: toBedrockTools(params.tools) };
    }

    const bodyStr = JSON.stringify(body);

    const baseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };

    const signedHeaders = await signRequest('POST', url, baseHeaders, bodyStr, this.credentials);

    // Remove 'host' header since fetch sets it automatically
    delete signedHeaders['host'];

    const res = await fetch(url, {
      method: 'POST',
      headers: signedHeaders,
      body: bodyStr,
      signal: params.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 403) {
        throw new Error('AWS 자격 증명이 유효하지 않거나 권한이 부족합니다. 설정에서 확인해주세요.');
      } else if (status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (status === 404) {
        throw new Error('Bedrock 모델을 찾을 수 없습니다. 리전과 모델 ID를 확인해주세요.');
      } else if (status === 503) {
        throw new Error('Bedrock 서버가 일시적으로 사용 불가 상태입니다. 잠시 후 다시 시도해주세요.');
      } else {
        let detail = '';
        try {
          const errBody = await res.json();
          detail = (errBody as Record<string, string>).message ?? '';
        } catch { /* ignore */ }
        throw new Error(`Bedrock API 오류가 발생했습니다 (${status}). ${detail}`.trim());
      }
    }

    const data = await res.json();
    return fromBedrockResponse(data);
  }
}
