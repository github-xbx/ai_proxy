import { ConfigManager } from '../../src/config';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('ConfigManager', () => {
  test('should load config from yaml file', () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const config = configManager.getConfig();

    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe('localhost');
    expect(config.plugins.deepseek).toBeDefined();
    expect(config.plugins.mimo).toBeDefined();
  });

  test('should resolve environment variables', () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const pluginConfig = configManager.getPluginConfig('deepseek');
    expect(pluginConfig?.apiKey).toBe('test-key');

    delete process.env.DEEPSEEK_API_KEY;
  });

  test('should get plugin config by name', () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const deepseekConfig = configManager.getPluginConfig('deepseek');
    expect(deepseekConfig?.name).toBe('deepseek');
    expect(deepseekConfig?.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  test('should return undefined for unknown plugin', () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const unknownConfig = configManager.getPluginConfig('unknown');
    expect(unknownConfig).toBeUndefined();
  });

  test('should exclude disabled plugins from config', () => {
    const tmpFile = path.join(os.tmpdir(), `config-test-${Date.now()}.yaml`);
    fs.writeFileSync(tmpFile, [
      'server:',
      '  port: 3000',
      '  host: localhost',
      'logging:',
      '  level: info',
      'plugins:',
      '  enabled-plugin:',
      '    enabled: true',
      '    baseUrl: https://enabled.example.com',
      '    apiKey: key1',
      '    models:',
      '      - claudeModel: claude-3',
      '        actualModel: gpt-4',
      '  disabled-plugin:',
      '    enabled: false',
      '    baseUrl: https://disabled.example.com',
      '    apiKey: key2',
      '    models:',
      '      - claudeModel: claude-3',
      '        actualModel: gpt-4',
      ''].join('\n'), 'utf-8');

    const configManager = new ConfigManager(tmpFile);
    fs.unlinkSync(tmpFile);

    const plugins = configManager.getPlugins();
    expect(plugins['enabled-plugin']).toBeDefined();
    expect(plugins['disabled-plugin']).toBeUndefined();
  });
});
