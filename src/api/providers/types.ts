/** Unified AI provider types — provider-agnostic message format */

// ─── Provider identifiers ───────────────────────────────────────────

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'bedrock';

// ─── Unified message format (based on Anthropic's structure) ────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: ChatContent[];
}

export type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ChatResponse {
  content: ChatContent[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage?: { inputTokens: number; outputTokens: number };
}

// ─── Provider interface ─────────────────────────────────────────────

export interface AIProvider {
  chat(params: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): Promise<ChatResponse>;
}

// ─── Provider credential configs ────────────────────────────────────

export interface AnthropicCredentials {
  apiKey: string;
}

export interface OpenAICredentials {
  apiKey: string;
}

export interface GeminiCredentials {
  apiKey: string;
}

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export type ProviderCredentials =
  | { provider: 'anthropic'; credentials: AnthropicCredentials }
  | { provider: 'openai'; credentials: OpenAICredentials }
  | { provider: 'gemini'; credentials: GeminiCredentials }
  | { provider: 'bedrock'; credentials: BedrockCredentials };
