import path from 'path';
import { ConfigManager } from './config';
import { PluginManager } from './plugin-manager';
import { Router } from './router';
import { Server } from './server';
import { Logger } from './utils/logger';

async function main(): Promise<void> {
  const configPath = path.join(__dirname, '../config/models.yaml');

  const configManager = new ConfigManager(configPath);
  const config = configManager.getConfig();

  const logger = new Logger(config.logging);
  logger.info('Starting AI Proxy server...');

  const pluginManager = new PluginManager(configManager);
  await pluginManager.discoverPlugins();

  const router = new Router(pluginManager);
  const server = new Server(configManager, pluginManager, router, logger);
  await server.start();

  logger.info('AI Proxy server is ready');
  logger.info('Configure Claude Desktop with:');
  logger.info(`ANTHROPIC_BASE_URL=http://${config.server.host}:${config.server.port}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
