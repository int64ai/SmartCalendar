/** Tool use loop — ported from server.py lines 388-447 */

import type { AnthropicContent, AnthropicMessage, AnthropicToolDef } from './message-types';
import { callAnthropic } from './anthropic-client';
import { MAX_TOOL_ITERATIONS } from '../shared/constants';

export interface ToolUseLoopResult {
  text: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
}

export async function runToolUseLoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  tools: AnthropicToolDef[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  onToolCall?: (toolName: string) => void,
  signal?: AbortSignal,
): Promise<ToolUseLoopResult> {
  const allToolCalls: ToolUseLoopResult['toolCalls'] = [];
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const response = await callAnthropic(apiKey, model, systemPrompt, messages, tools, signal);

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const text = response.content
        .filter((c): c is Extract<AnthropicContent, { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join('');
      return { text: text || '응답을 생성할 수 없습니다.', toolCalls: allToolCalls };
    }

    if (response.stop_reason === 'tool_use') {
      // Add assistant message with the full content (text + tool_use blocks)
      messages.push({ role: 'assistant', content: response.content });

      // Extract tool_use blocks and execute each
      const toolUseBlocks = response.content.filter(
        (c): c is Extract<AnthropicContent, { type: 'tool_use' }> => c.type === 'tool_use',
      );

      const toolResults: AnthropicContent[] = [];

      for (const toolBlock of toolUseBlocks) {
        allToolCalls.push({ name: toolBlock.name, input: toolBlock.input });
        onToolCall?.(toolBlock.name);

        let resultContent: string;
        let isError = false;

        try {
          const result = await executeTool(toolBlock.name, toolBlock.input);
          resultContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          if (typeof result === 'object' && result !== null && 'error' in result) {
            isError = true;
          }
        } catch (err) {
          resultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
          isError = true;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: resultContent,
          is_error: isError,
        });
      }

      // Add user message with tool results
      messages.push({ role: 'user', content: toolResults });

      // Continue loop — next iteration will call the API again
      continue;
    }

    // Unknown stop reason — return whatever text we have
    break;
  }

  // Exceeded max iterations
  const lastText = messages
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.content)
    .filter((c): c is Extract<AnthropicContent, { type: 'text' }> => c.type === 'text')
    .map((c) => c.text)
    .pop();

  return { text: lastText ?? 'Tool 호출 횟수 초과. 요청을 다시 시도해주세요.', toolCalls: allToolCalls };
}
