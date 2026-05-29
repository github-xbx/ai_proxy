import { Server } from '../../src/server';
import { ConfigManager } from '../../src/config';
import { PluginManager } from '../../src/plugin-manager';
import { Router } from '../../src/router';
import { Logger } from '../../src/utils/logger';
import path from 'path';
import request from 'supertest';

// Mock global fetch to avoid real API calls
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('Proxy Integration', () => {
  let server: Server;
  let app: ReturnType<Server['getApp']>;

  beforeAll(async () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);
    const pluginManager = new PluginManager(configManager);
    await pluginManager.discoverPlugins();

    const logger = new Logger({ ...configManager.getConfig().logging, file: false });
    const router = new Router(pluginManager);
    server = new Server(configManager, pluginManager, router, logger);
    app = server.getApp();
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('should handle non-streaming request', async () => {
    const mockResponseBody = {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'deepseek-chat',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello! How can I help you?' },
          finish_reason: 'stop'
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponseBody,
      text: async () => JSON.stringify(mockResponseBody)
    });

    const response = await request(app)
      .post('/v1/messages')
      .send({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say hello' }]
      });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // Verify fetch was called (plugin made an upstream request)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('should handle streaming request', async () => {
    // Create a mock ReadableStream for SSE
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" World"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(async () => {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex++];
          return { done: false, value: encoder.encode(chunk) };
        }
        return { done: true, value: undefined };
      }),
      cancel: jest.fn().mockResolvedValue(undefined)
    };

    const mockBody = {
      getReader: () => mockReader
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockBody,
      json: async () => ({}),
      text: async () => ''
    });

    const response = await request(app)
      .post('/v1/messages')
      .send({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: true
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('event: message_start');
    expect(response.text).toContain('event: content_block_start');
    expect(response.text).toContain('event: content_block_stop');
    expect(response.text).toContain('event: message_stop');
  });

  test('should return error for unknown model', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .send({
        model: 'unknown-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(response.status).toBe(404);
    expect(response.body.error.type).toBe('invalid_request_error');
  });

  test('should return error when model is missing', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .send({
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe('invalid_request_error');
  });

  test('should return 404 for undefined routes', async () => {
    const response = await request(app).get('/v1/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error.type).toBe('not_found_error');
  });
});
