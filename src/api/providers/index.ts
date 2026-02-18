/** Provider factory + model catalog */

import type { AIProvider, ProviderId, ProviderCredentials } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { BedrockProvider } from './bedrock';

// Re-export types for convenience
export type { AIProvider, ProviderId, ProviderCredentials, ChatMessage, ChatContent, ChatResponse, ToolDef } from './types';

// ─── Model catalog ──────────────────────────────────────────────────

export interface ModelOption {
  value: string;
  label: string;
}

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
  ],
  bedrock: [],  // Bedrock models are filtered by region — see BEDROCK_INFERENCE_PROFILES
};

// ─── Bedrock inference profiles by region ────────────────────────────
// Source: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html

export interface BedrockProfile {
  id: string;
  label: string;
  sourceRegions: string[];
}

export const BEDROCK_INFERENCE_PROFILES: BedrockProfile[] = [
  // ── Global cross-region ──
  { id: 'global.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (Global)', sourceRegions: ['af-south-1','ap-east-2','ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ap-southeast-5','ap-southeast-7','ca-central-1','ca-west-1','eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3','il-central-1','me-central-1','me-south-1','mx-central-1','sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'global.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Global)', sourceRegions: ['af-south-1','ap-east-2','ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ap-southeast-5','ap-southeast-7','ca-central-1','ca-west-1','eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3','il-central-1','me-central-1','me-south-1','mx-central-1','sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'global.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (Global)', sourceRegions: ['ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ca-central-1','eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2','me-south-1','af-south-1','me-central-1','il-central-1'] },
  { id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (Global)', sourceRegions: ['af-south-1','ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ca-central-1','ca-west-1','eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2','me-central-1','il-central-1'] },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (Global)', sourceRegions: ['ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ca-central-1','eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2','me-south-1','af-south-1','me-central-1','il-central-1'] },
  { id: 'global.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (Global)', sourceRegions: ['ap-northeast-1','eu-west-1','us-east-1','us-east-2','us-west-2'] },

  // ── US cross-region ──
  { id: 'us.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (US)', sourceRegions: ['ca-central-1','ca-west-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (US)', sourceRegions: ['ca-central-1','ca-west-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (US)', sourceRegions: ['ca-central-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (US)', sourceRegions: ['ca-central-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (US)', sourceRegions: ['ca-central-1','us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-opus-4-20250514-v1:0', label: 'Claude Opus 4 (US)', sourceRegions: ['us-east-1','us-east-2','us-west-2'] },
  { id: 'us.anthropic.claude-opus-4-1-20250805-v1:0', label: 'Claude Opus 4.1 (US)', sourceRegions: ['us-east-1','us-east-2','us-west-2'] },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (US)', sourceRegions: ['us-east-1','us-east-2','us-west-1','us-west-2'] },
  { id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (US)', sourceRegions: ['us-east-1','us-east-2','us-west-2'] },
  { id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2 (US)', sourceRegions: ['us-east-1','us-east-2','us-west-2'] },
  { id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku (US)', sourceRegions: ['us-east-1','us-east-2','us-west-2'] },

  // ── EU cross-region ──
  { id: 'eu.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (EU)', sourceRegions: ['eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3'] },
  { id: 'eu.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (EU)', sourceRegions: ['eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3'] },
  { id: 'eu.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (EU)', sourceRegions: ['eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3'] },
  { id: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (EU)', sourceRegions: ['eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3'] },
  { id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (EU)', sourceRegions: ['eu-central-1','eu-central-2','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-2','eu-west-3'] },
  { id: 'eu.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (EU)', sourceRegions: ['eu-central-1','eu-north-1','eu-south-1','eu-south-2','eu-west-1','eu-west-3','il-central-1'] },
  { id: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (EU)', sourceRegions: ['eu-central-1','eu-north-1','eu-west-1','eu-west-3'] },

  // ── APAC cross-region ──
  { id: 'apac.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (APAC)', sourceRegions: ['ap-east-2','ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2','ap-southeast-3','ap-southeast-4','ap-southeast-5','ap-southeast-7','me-central-1'] },
  { id: 'apac.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (APAC)', sourceRegions: ['ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2'] },
  { id: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2 (APAC)', sourceRegions: ['ap-northeast-1','ap-northeast-2','ap-northeast-3','ap-south-1','ap-south-2','ap-southeast-1','ap-southeast-2'] },

  // ── JP cross-region ──
  { id: 'jp.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (JP)', sourceRegions: ['ap-northeast-1','ap-northeast-3'] },
  { id: 'jp.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (JP)', sourceRegions: ['ap-northeast-1','ap-northeast-3'] },
  { id: 'jp.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (JP)', sourceRegions: ['ap-northeast-1','ap-northeast-3'] },

  // ── AU cross-region ──
  { id: 'au.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (AU)', sourceRegions: ['ap-southeast-2','ap-southeast-4'] },
  { id: 'au.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (AU)', sourceRegions: ['ap-southeast-2','ap-southeast-4'] },
  { id: 'au.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (AU)', sourceRegions: ['ap-southeast-2','ap-southeast-4'] },
  { id: 'au.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (AU)', sourceRegions: ['ap-southeast-2','ap-southeast-4'] },
];

/** Get Bedrock models available for a specific region */
export function getBedrockModelsForRegion(region: string): ModelOption[] {
  return BEDROCK_INFERENCE_PROFILES
    .filter(p => p.sourceRegions.includes(region))
    .map(p => ({ value: p.id, label: p.label }));
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  bedrock: 'AWS Bedrock',
};

export const ALL_PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'bedrock'];

// ─── Factory ────────────────────────────────────────────────────────

export function createProvider(config: ProviderCredentials): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.credentials);
    case 'openai':
      return new OpenAIProvider(config.credentials);
    case 'gemini':
      return new GeminiProvider(config.credentials);
    case 'bedrock':
      return new BedrockProvider(config.credentials);
  }
}

/** Check if credentials are configured for the given provider */
export function isProviderConfigured(config: ProviderCredentials): boolean {
  switch (config.provider) {
    case 'anthropic':
      return !!config.credentials.apiKey;
    case 'openai':
      return !!config.credentials.apiKey;
    case 'gemini':
      return !!config.credentials.apiKey;
    case 'bedrock':
      return !!(
        config.credentials.accessKeyId &&
        config.credentials.secretAccessKey &&
        config.credentials.region
      );
  }
}
