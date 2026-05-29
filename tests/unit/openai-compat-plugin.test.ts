import { OpenAICompatPlugin } from '../../plugins/openai-compat';
import { PluginConfig, TransformContext } from '../../plugin-sdk/types';

describe('OpenAICompatPlugin', () => {
  let plugin: OpenAICompatPlugin;

  const config: PluginConfig = {
    name: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    models: [
      {
        claudeModel: 'claude-3-5-sonnet-20241022',
        actualModel: 'gpt-4',
        supportsStreaming: true
      }
    ]
  };

  beforeEach(async () => {
    plugin = new OpenAICompatPlugin();
    await plugin.initialize(config);
  });

  test('should have correct plugin info', () => {
    expect(plugin.name).toBe('openai-compat');
    expect(plugin.version).toBe('1.0.0');
  });

  test('should return model mapping', () => {
    const models = plugin.getModelMapping();
    expect(models).toHaveLength(1);
    expect(models[0].actualModel).toBe('gpt-4');
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

    expect(result.model).toBe('gpt-4');
    expect(result.max_tokens).toBe(1024);
    expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('should return correct endpoint', () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    expect(plugin.getEndpoint(ctx)).toBe('https://api.openai.com/v1/chat/completions');
  });

  test('should throw on getEndpoint when not initialized', async () => {
    const uninitializedPlugin = new OpenAICompatPlugin();
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    expect(() => uninitializedPlugin.getEndpoint(ctx)).toThrow(
      'Plugin "openai-compat" has not been initialized. Call initialize() before using getEndpoint().'
    );
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

  test('should throw on transformRequest when messages is undefined', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024
      } as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    await expect(plugin.transformRequest(ctx)).rejects.toThrow(
      'Invalid request: messages must be an array'
    );
  });

  test('should throw on transformRequest when messages is null', async () => {
    const ctx: TransformContext = {
      originalRequest: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: null
      } as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    await expect(plugin.transformRequest(ctx)).rejects.toThrow(
      'Invalid request: messages must be an array'
    );
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

  test('should transform response to Claude format', async () => {
    const ctx: TransformContext = {
      originalRequest: {} as any,
      modelConfig: config.models[0],
      pluginConfig: config
    };

    const openaiResponse = {
      id: 'chatcmpl-123',
      choices: [{
        message: { content: 'Hello there!' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5
      }
    };

    const result = await plugin.transformResponse(ctx, openaiResponse);

    expect(result.id).toBe('chatcmpl-123');
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content).toEqual([{ type: 'text', text: 'Hello there!' }]);
    expect(result.model).toBe('claude-3-5-sonnet-20241022');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(5);
  });
});
