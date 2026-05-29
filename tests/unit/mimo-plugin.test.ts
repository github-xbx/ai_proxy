import { MiMoPlugin } from '../../plugins/mimo';
import { PluginConfig, TransformContext } from '../../plugin-sdk/types';

describe('MiMoPlugin', () => {
  let plugin: MiMoPlugin;

  const config: PluginConfig = {
    name: 'mimo',
    baseUrl: 'https://api.xiaomi.com/v1',
    apiKey: 'test-key',
    models: [
      {
        claudeModel: 'claude-3-5-sonnet-20241022',
        actualModel: 'mimo-chat',
        supportsStreaming: true
      }
    ]
  };

  beforeEach(async () => {
    plugin = new MiMoPlugin();
    await plugin.initialize(config);
  });

  test('should have correct plugin info', () => {
    expect(plugin.name).toBe('mimo');
    expect(plugin.version).toBe('1.0.0');
  });

  test('should return model mapping', () => {
    const models = plugin.getModelMapping();
    expect(models).toHaveLength(1);
    expect(models[0].actualModel).toBe('mimo-chat');
  });

  test('should transform request', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      },
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const result = await plugin.transformRequest(ctx);

    expect(result.model).toBe('mimo-chat');
    expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('should return correct endpoint', () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    expect(plugin.getEndpoint(ctx)).toBe('https://api.xiaomi.com/v1/chat/completions');
  });

  test('should transform request with system prompt', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are a helpful assistant'
      },
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const result = await plugin.transformRequest(ctx);

    expect(result.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  test('should transform stream chunk to Claude format', async () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const openaiChunk = 'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}';

    const result = await plugin.transformStreamChunk(ctx, openaiChunk);

    expect(result).toContain('event: content_block_delta');
    expect(result).toContain('"type":"text_delta"');
    expect(result).toContain('"text":"Hello"');
  });

  test('should include top_p in transformed request', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 0.9
      },
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const result = await plugin.transformRequest(ctx);

    expect(result.top_p).toBe(0.9);
  });

  test('should throw on invalid response with missing choices', async () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    await expect(plugin.transformResponse(ctx, { id: 'test', choices: [] }))
      .rejects.toThrow('Invalid response: missing choices');
  });
});
