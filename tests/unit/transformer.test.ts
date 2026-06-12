import * as transformer from '../../src/transformer';
import { RouteConfig, ClaudeRequest } from '../../src/types';

describe('Transformer', () => {
  const anthropicRoute: RouteConfig = {
    targetModel: 'deepseek-v4-pro[1m]',
    protocol: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKey: 'test-key',
    streaming: true
  };

  const openaiRoute: RouteConfig = {
    targetModel: 'gpt-4',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com',
    apiKey: 'test-key',
    streaming: true
  };

  describe('getEndpoint', () => {
    test('should return anthropic endpoint', () => {
      const endpoint = transformer.getEndpoint(anthropicRoute);
      expect(endpoint).toBe('https://api.deepseek.com/anthropic/v1/messages');
    });

    test('should return openai endpoint', () => {
      const endpoint = transformer.getEndpoint(openaiRoute);
      expect(endpoint).toBe('https://api.openai.com/chat/completions');
    });
  });

  describe('getHeaders', () => {
    test('should return anthropic headers', () => {
      const headers = transformer.getHeaders(anthropicRoute);
      expect(headers['x-api-key']).toBe('test-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
    });

    test('should return openai headers', () => {
      const headers = transformer.getHeaders(openaiRoute);
      expect(headers['Authorization']).toBe('Bearer test-key');
    });
  });

  describe('transformRequest', () => {
    const baseRequest: ClaudeRequest = {
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }]
    };

    test('should transform anthropic request (passthrough with model swap)', () => {
      const result = transformer.transformRequest(anthropicRoute, baseRequest);
      expect(result.model).toBe('deepseek-v4-pro[1m]');
      expect(result.messages).toEqual(baseRequest.messages);
    });

    test('should transform openai request', () => {
      const result = transformer.transformRequest(openaiRoute, baseRequest);
      expect(result.model).toBe('gpt-4');
      expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    test('should include system message for openai', () => {
      const requestWithSystem: ClaudeRequest = {
        ...baseRequest,
        system: 'You are helpful'
      };
      const result = transformer.transformRequest(openaiRoute, requestWithSystem);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
      expect(result.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });
  });

  describe('transformResponse', () => {
    test('should passthrough anthropic response', () => {
      const response = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi' }],
        model: 'deepseek-v4-pro[1m]',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      };
      const result = transformer.transformResponse(anthropicRoute, response, 'claude-sonnet-4-5');
      expect(result).toEqual(response);
    });

    test('should transform openai response', () => {
      const response = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hi there!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      };
      const result = transformer.transformResponse(openaiRoute, response, 'claude-3-5-sonnet-20241022');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content[0].text).toBe('Hi there!');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.stop_reason).toBe('end_turn');
    });
  });

  describe('transformStreamChunk', () => {
    test('should passthrough anthropic stream chunk', () => {
      const chunk = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n';
      const result = transformer.transformStreamChunk(anthropicRoute, chunk);
      expect(result).toBe(chunk);
    });

    test('should transform openai stream chunk', () => {
      const chunk = 'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';
      const result = transformer.transformStreamChunk(openaiRoute, chunk);
      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"text":"Hello"');
    });

    test('should handle openai [DONE] marker', () => {
      const chunk = 'data: [DONE]\n\n';
      const result = transformer.transformStreamChunk(openaiRoute, chunk);
      expect(result).toContain('event: message_stop');
    });
  });
});
