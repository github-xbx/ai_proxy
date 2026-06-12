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
    expect(config.routes['claude-sonnet-4-5']).toBeDefined();
    expect(config.routes['claude-sonnet-4-6']).toBeDefined();
  });

  test('should resolve environment variables', () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const route = configManager.getRoute('claude-sonnet-4-5');
    expect(route?.apiKey).toBe('test-key');

    delete process.env.DEEPSEEK_API_KEY;
  });

  test('should get route config by claude model name', () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const route = configManager.getRoute('claude-sonnet-4-5');
    expect(route?.targetModel).toBe('deepseek-v4-pro[1m]');
    expect(route?.protocol).toBe('anthropic');
    expect(route?.baseUrl).toBe('https://api.deepseek.com/anthropic');
  });

  test('should return undefined for unknown model', () => {
    const configPath = path.join(__dirname, '../../config/models.yaml');
    const configManager = new ConfigManager(configPath);

    const route = configManager.getRoute('unknown-model');
    expect(route).toBeUndefined();
  });

  test('should parse routes from yaml', () => {
    const tmpFile = path.join(os.tmpdir(), `config-test-${Date.now()}.yaml`);
    fs.writeFileSync(tmpFile, [
      'server:',
      '  port: 3000',
      '  host: localhost',
      'logging:',
      '  level: info',
      'routes:',
      '  claude-test:',
      '    targetModel: gpt-4',
      '    protocol: openai',
      '    baseUrl: https://api.example.com',
      '    apiKey: test-key',
      '    streaming: true',
      ''].join('\n'), 'utf-8');

    const configManager = new ConfigManager(tmpFile);
    fs.unlinkSync(tmpFile);

    const routes = configManager.getRoutes();
    expect(routes['claude-test']).toBeDefined();
    expect(routes['claude-test'].targetModel).toBe('gpt-4');
    expect(routes['claude-test'].protocol).toBe('openai');
  });
});
