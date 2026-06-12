import { Server } from '../../src/server';
import { ConfigManager } from '../../src/config';
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

    const logger = new Logger({ ...configManager.getConfig().logging, file: false });
    const router = new Router(configManager);
    server = new Server(configManager, router, logger);
    app = server.getApp();
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('should handle non-streaming request via anthropic protocol', async () => {
    const mockResponseBody = {
      id: 'msg-test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello! How can I help you?' }],
      model: 'deepseek-v4-pro[1m]',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 8 }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponseBody,
      text: async () => JSON.stringify(mockResponseBody)
    });

    const response = await request(app)
      .post('/v1/messages')
      .send({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say hello' }]
      });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('should handle streaming request via anthropic protocol', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
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
        model: 'claude-sonnet-4-5',
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
