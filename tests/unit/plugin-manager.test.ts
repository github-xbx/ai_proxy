import { PluginManager } from '../../src/plugin-manager';
import { ConfigManager } from '../../src/config';
import path from 'path';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let configManager: ConfigManager;

  beforeEach(() => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    configManager = new ConfigManager(configPath);
    pluginManager = new PluginManager(configManager);
  });

  describe('validatePlugin', () => {
    test('should reject non-object input', () => {
      expect(() => PluginManager.validatePlugin(null, 'test')).toThrow(
        'Plugin "test" must export an object, got object',
      );
      expect(() => PluginManager.validatePlugin('string', 'test')).toThrow(
        'Plugin "test" must export an object, got string',
      );
      expect(() => PluginManager.validatePlugin(42, 'test')).toThrow(
        'Plugin "test" must export an object, got number',
      );
    });

    test('should reject object missing required string properties', () => {
      const missingName = {
        version: '1.0',
        description: 'desc',
        initialize: jest.fn(),
        getModelMapping: jest.fn(),
        transformRequest: jest.fn(),
        transformResponse: jest.fn(),
        transformStreamChunk: jest.fn(),
        getEndpoint: jest.fn(),
        getHeaders: jest.fn(),
      };
      expect(() => PluginManager.validatePlugin(missingName, 'test')).toThrow(
        'Plugin "test" is missing required string property "name"',
      );
    });

    test('should reject object missing required methods', () => {
      const missingMethods = {
        name: 'test',
        version: '1.0',
        description: 'desc',
      };
      expect(() => PluginManager.validatePlugin(missingMethods, 'test')).toThrow(
        'Plugin "test" is missing required method "initialize"',
      );
    });

    test('should accept a valid plugin object', () => {
      const validPlugin = {
        name: 'test',
        version: '1.0',
        description: 'desc',
        initialize: jest.fn(),
        getModelMapping: jest.fn(),
        transformRequest: jest.fn(),
        transformResponse: jest.fn(),
        transformStreamChunk: jest.fn(),
        getEndpoint: jest.fn(),
        getHeaders: jest.fn(),
      };
      expect(() => PluginManager.validatePlugin(validPlugin, 'test')).not.toThrow();
    });
  });

  test('should initialize plugin manager', () => {
    expect(pluginManager).toBeDefined();
  });

  test('should load plugins', async () => {
    await pluginManager.discoverPlugins();

    const deepseek = pluginManager.getPlugin('deepseek');
    expect(deepseek).toBeDefined();
    expect(deepseek?.name).toBe('deepseek');

    const mimo = pluginManager.getPlugin('mimo');
    expect(mimo).toBeDefined();
    expect(mimo?.name).toBe('mimo');
  });

  test('should find plugin for model', async () => {
    await pluginManager.discoverPlugins();

    const result = pluginManager.findPluginForModel('claude-3-5-sonnet-20241022');
    expect(result).toBeDefined();
    expect(result?.plugin.name).toBe('deepseek');
    expect(result?.modelConfig.actualModel).toBe('deepseek-chat');
  });

  test('should return null for unknown model', async () => {
    await pluginManager.discoverPlugins();

    const result = pluginManager.findPluginForModel('unknown-model');
    expect(result).toBeNull();
  });

  test('should get all plugins', async () => {
    await pluginManager.discoverPlugins();

    const plugins = pluginManager.getAllPlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(2);
  });
});
