import { describe, it, expect, vi } from 'vitest';
import { runToolUseLoop } from '../../src/api/tool-use-loop';
import type { AIProvider, ChatMessage, ChatResponse, ToolDef } from '../../src/api/providers/types';

function createMockProvider(responses: ChatResponse[]): AIProvider {
  let callIndex = 0;
  return {
    chat: vi.fn(async () => {
      const response = responses[callIndex];
      callIndex++;
      if (!response) throw new Error('No more mock responses');
      return response;
    }),
  };
}

describe('Tool Use Loop', () => {
  const tools: ToolDef[] = [
    {
      name: 'test_tool',
      description: 'A test tool',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ];

  it('should return text on end_turn', async () => {
    const provider = createMockProvider([
      {
        content: [{ type: 'text', text: '안녕하세요!' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    ]);

    const messages: ChatMessage[] = [
      { role: 'user', content: [{ type: 'text', text: '안녕' }] },
    ];

    const result = await runToolUseLoop(
      provider, 'claude-sonnet-4-20250514', 'system prompt',
      messages, tools,
      async () => ({}),
    );

    expect(result.text).toBe('안녕하세요!');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('should execute tools and continue loop', async () => {
    const provider = createMockProvider([
      {
        content: [
          { type: 'text', text: '도구를 사용하겠습니다.' },
          { type: 'tool_use', id: 'tu_1', name: 'test_tool', input: {} },
        ],
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: [{ type: 'text', text: '완료했습니다.' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 30, outputTokens: 10 },
      },
    ]);

    const executeTool = vi.fn().mockResolvedValue({ result: 'ok' });
    const onToolCall = vi.fn();

    const messages: ChatMessage[] = [
      { role: 'user', content: [{ type: 'text', text: '도구 테스트' }] },
    ];

    const result = await runToolUseLoop(
      provider, 'claude-sonnet-4-20250514', 'system prompt',
      messages, tools,
      executeTool, onToolCall,
    );

    expect(result.text).toBe('완료했습니다.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('test_tool');
    expect(executeTool).toHaveBeenCalledOnce();
    expect(onToolCall).toHaveBeenCalledWith('test_tool');
  });

  it('should handle tool execution errors gracefully', async () => {
    const provider = createMockProvider([
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'test_tool', input: {} },
        ],
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: [{ type: 'text', text: '에러가 발생했습니다.' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 30, outputTokens: 10 },
      },
    ]);

    const executeTool = vi.fn().mockRejectedValue(new Error('tool failed'));

    const messages: ChatMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'test' }] },
    ];

    const result = await runToolUseLoop(
      provider, 'claude-sonnet-4-20250514', 'system prompt',
      messages, tools, executeTool,
    );

    expect(result.text).toBe('에러가 발생했습니다.');
  });
});
