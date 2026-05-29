import { Server } from '../../src/server';
import { ConfigManager } from '../../src/config';
import { PluginManager } from '../../src/plugin-manager';
import { Router } from '../../src/router';
import { Logger } from '../../src/utils/logger';
import path from 'path';
import request from 'supertest';

describe('Server Integration', () => {
  let server: Server;
  let app: ReturnType<Server['getApp']>;

  beforeAll(async () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);
    const pluginManager = new PluginManager(configManager);
    await pluginManager.discoverPlugins();

    const logger = new Logger(configManager.getConfig().logging);
    const router = new Router(pluginManager);
    server = new Server(configManager, pluginManager, router, logger);
    app = server.getApp();
  });

  test('should create server', () => {
    expect(server).toBeDefined();
  });

  test('should have express app', () => {
    expect(app).toBeDefined();
  });

  test('should handle health check', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('POST /v1/messages with missing model should return 400', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.type).toBe('invalid_request_error');
  });

  test('POST /v1/messages with unknown model should return 404', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .send({
        model: 'nonexistent-model-xyz',
        messages: [{ role: 'user', content: 'hello' }]
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.type).toBe('invalid_request_error');
  });

  test('GET /unknown should return 404', async () => {
    const response = await request(app).get('/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.type).toBe('not_found_error');
    expect(response.body.error.message).toContain('Route GET /unknown not found');
  });
});
