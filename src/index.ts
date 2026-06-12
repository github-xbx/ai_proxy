import path from 'path';
import { ConfigManager } from './config';
import { Router } from './router';
import { Server } from './server';
import { Logger } from './utils/logger';

/**
 * 获取应用根目录
 */
function getAppDir(): string {
  return process.cwd();
}

/**
 * 主入口函数
 * 启动流程：加载配置 -> 创建路由器 -> 启动 HTTP 服务
 */
async function main(): Promise<void> {
  const appDir = getAppDir();
  const configPath = path.join(appDir, 'config', 'models.yaml');

  // 初始化配置管理器，读取 models.yaml
  const configManager = new ConfigManager(configPath);
  const config = configManager.getConfig();

  // 初始化日志器
  const logger = new Logger(config.logging);
  logger.info('Starting AI Proxy server...');

  // 创建路由器（根据模型名查找路由配置）
  const router = new Router(configManager);
  // 创建并启动 HTTP 服务器
  const server = new Server(configManager, router, logger);
  await server.start();

  logger.info('AI Proxy server is ready');
  logger.info('Configure Claude Desktop with:');
  logger.info(`ANTHROPIC_BASE_URL=http://${config.server.host}:${config.server.port}`);
}

// 启动服务，失败则退出进程
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
