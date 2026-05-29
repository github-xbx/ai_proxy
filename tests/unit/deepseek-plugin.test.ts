import { DeepSeekPlugin } from '../../plugins/deepseek';
import { PluginConfig, TransformContext } from '../../plugin-sdk/types';

describe('DeepSeekPlugin', () => {
  let plugin: DeepSeekPlugin;

  const config: PluginConfig = {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKey: 'test-key',
    models: [
      {
        claudeModel: 'claude-sonnet-4-5',
        actualModel: 'deepseek-v4-pro[1m]',
        supportsStreaming: true
      }
    ]
  };

  beforeEach(async () => {
    plugin = new DeepSeekPlugin();
    await plugin.initialize(config);
  });

  test('should have correct plugin info', () => {
    expect(plugin.name).toBe('deepseek');
    expect(plugin.version).toBe('1.0.0');
  });

  test('should return model mapping', () => {
    const models = plugin.getModelMapping();
    expect(models).toHaveLength(1);
    expect(models[0].actualModel).toBe('deepseek-v4-pro[1m]');
  });

  test('should pass through request for Anthropic endpoint', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      },
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const result = await plugin.transformRequest(ctx);
    // Anthropic 兼容端点，直接透传请求
    expect(result).toEqual(ctx.originalRequest);
  });

  test('should return correct Anthropic endpoint', () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    expect(plugin.getEndpoint(ctx)).toBe('https://api.deepseek.com/anthropic/v1/messages');
  });

  test('should return Anthropic-compatible headers', () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const headers = plugin.getHeaders(ctx);
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
