import { Router } from '../../src/router';
import { ConfigManager } from '../../src/config';
import path from 'path';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);
    router = new Router(configManager);
  });

  test('should create router', () => {
    expect(router).toBeDefined();
  });

  test('should have messages route', () => {
    const routes = router.getRoutes();
    expect(routes).toHaveProperty('/v1/messages');
  });

  test('should handle valid model request', async () => {
    const mockReq = {
      body: {
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    };

    const result = await router.routeRequest(mockReq as any);
    expect(result).toBeDefined();
    expect(result.claudeModel).toBe('claude-sonnet-4-5');
    expect(result.routeConfig).toBeDefined();
    expect(result.routeConfig.targetModel).toBe('deepseek-v4-pro[1m]');
  });

  test('should throw error for unknown model', async () => {
    const mockReq = {
      body: {
        model: 'unknown-model',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    };

    await expect(router.routeRequest(mockReq as any)).rejects.toThrow('No route found for model');
  });

  test('should throw error for missing model field', async () => {
    const mockReq = {
      body: {
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    };

    await expect(router.routeRequest(mockReq as any)).rejects.toThrow('Model is required');
  });

  test('should throw error for missing request body', async () => {
    const mockReq = {};

    await expect(router.routeRequest(mockReq as any)).rejects.toThrow('Request body is required');
  });
});
