import { describe, it, expect, vi } from 'vitest';
import { runToolUseLoop } from '../../src/api/tool-use-loop';
import type { AnthropicMessage, AnthropicResponse, AnthropicToolDef } from '../../src/api/message-types';

// Mock the anthropic client
vi.mock('../../src/api/anthropic-client', () => ({
  callAnthropic: vi.fn(),
}));

import { callAnthropic } from '../../src/api/anthropic-client';
const mockedCallAnthropic = vi.mocked(callAnthropic);

describe('Tool Use Loop', () => {
  const tools: AnthropicToolDef[] = [
    {
      name: 'test_tool',
      description: 'A test tool',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ];

  it('should return text on end_turn', async () => {
    const response: AnthropicResponse = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '안녕하세요!' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    mockedCallAnthropic.mockResolvedValueOnce(response);

    const messages: AnthropicMessage[] = [
      { role: 'user', content: [{ type: 'text', text: '안녕' }] },
    ];

    const result = await runToolUseLoop(
      'test-key', 'claude-sonnet-4-20250514', 'system prompt',
      messages, tools,
      async () => ({}),
    );

    expect(result.text).toBe('안녕하세요!');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('should execute tools and continue loop', async () => {
    // First call: tool_use
    const toolUseResponse: AnthropicResponse = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: '도구를 사용하겠습니다.' },
        { type: 'tool_use', id: 'tu_1', name: 'test_tool', input: {} },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    // Second call: end_turn
    const endTurnResponse: AnthropicResponse = {
      id: 'msg_2',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '완료했습니다.' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 30, output_tokens: 10 },
    };

    mockedCallAnthropic
      .mockResolvedValueOnce(toolUseResponse)
      .mockResolvedValueOnce(endTurnResponse);

    const executeTool = vi.fn().mockResolvedValue({ result: 'ok' });
    const onToolCall = vi.fn();

    const messages: AnthropicMessage[] = [
      { role: 'user', content: [{ type: 'text', text: '도구 테스트' }] },
    ];

    const result = await runToolUseLoop(
      'test-key', 'claude-sonnet-4-20250514', 'system prompt',
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
    const toolUseResponse: AnthropicResponse = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'test_tool', input: {} },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const endTurnResponse: AnthropicResponse = {
      id: 'msg_2',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '에러가 발생했습니다.' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 30, output_tokens: 10 },
    };

    mockedCallAnthropic
      .mockResolvedValueOnce(toolUseResponse)
      .mockResolvedValueOnce(endTurnResponse);

    const executeTool = vi.fn().mockRejectedValue(new Error('tool failed'));

    const messages: AnthropicMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'test' }] },
    ];

    const result = await runToolUseLoop(
      'test-key', 'claude-sonnet-4-20250514', 'system prompt',
      messages, tools, executeTool,
    );

    expect(result.text).toBe('에러가 발생했습니다.');
  });
});
