import { BasePlugin } from '../../plugin-sdk/base-plugin';
import { PluginConfig, ModelConfig, TransformContext, ClaudeRequest } from '../../plugin-sdk/types';

class TestPlugin extends BasePlugin {
  name = 'test-plugin';
  version = '1.0.0';
  description = 'Test plugin';

  getModelMapping(): ModelConfig[] {
    return this.config?.models || [];
  }

  async transformRequest(ctx: TransformContext): Promise<any> {
    return {
      model: ctx.modelConfig.actualModel,
      messages: ctx.originalRequest.messages
    };
  }

  async transformResponse(ctx: TransformContext, response: any): Promise<any> {
    return response;
  }

  async transformStreamChunk(ctx: TransformContext, chunk: string): Promise<string> {
    return chunk;
  }

  getEndpoint(ctx: TransformContext): string {
    return `${this.config?.baseUrl}/chat/completions`;
  }
}

describe('BasePlugin', () => {
  const config: PluginConfig = {
    name: 'test',
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'test-key',
    models: [
      {
        claudeModel: 'claude-3-5-sonnet',
        actualModel: 'test-model',
        supportsStreaming: true
      }
    ]
  };

  test('should initialize with config', async () => {
    const plugin = new TestPlugin();
    await plugin.initialize(config);

    expect(plugin.getModelMapping()).toHaveLength(1);
    expect(plugin.getModelMapping()[0].actualModel).toBe('test-model');
  });

  test('should return headers with API key', async () => {
    const plugin = new TestPlugin();
    await plugin.initialize(config);

    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const headers = plugin.getHeaders(ctx);
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('should transform request', async () => {
    const plugin = new TestPlugin();
    await plugin.initialize(config);

    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      },
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const result = await plugin.transformRequest(ctx);
    expect(result.model).toBe('test-model');
  });

  test('should throw when getHeaders called before initialize', () => {
    const plugin = new TestPlugin();
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    expect(() => plugin.getHeaders(ctx)).toThrow(
      'Plugin "test-plugin" has not been initialized. Call initialize() before using getHeaders().'
    );
  });

  test('should include API key in headers when initialized with key', async () => {
    const plugin = new TestPlugin();
    await plugin.initialize({ ...config, apiKey: 'my-secret' });

    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const headers = plugin.getHeaders(ctx);
    expect(headers['Authorization']).toBe('Bearer my-secret');
  });

  test('should produce "Bearer undefined" when apiKey is not set after initialize', async () => {
    const plugin = new TestPlugin();
    const configNoKey: PluginConfig = {
      name: 'test',
      baseUrl: 'https://api.test.com/v1',
      models: config.models
    };
    await plugin.initialize(configNoKey);

    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: configNoKey
    };

    const headers = plugin.getHeaders(ctx);
    // apiKey is optional, so this documents the behavior
    expect(headers['Authorization']).toBe('Bearer undefined');
  });

  test('should return empty models when config has no models', async () => {
    const plugin = new TestPlugin();
    expect(plugin.getModelMapping()).toEqual([]);
  });

  test('ClaudeRequest should be importable from plugin-sdk/types (no src/types dependency)', () => {
    // Compile-time verification: if ClaudeRequest were not exported from
    // plugin-sdk/types, this file would fail to compile.
    // At runtime, assert the import resolved to something truthy.
    const request: ClaudeRequest = {
      model: 'claude-3-5-sonnet',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are helpful',
    };
    expect(request.system).toBe('You are helpful');
    expect(request.messages).toHaveLength(1);
  });
});
