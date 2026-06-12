import path from 'path';
import fs from 'fs';
import { ConfigManager } from './config';
import { Router } from './router';
import { Server } from './server';
import { Logger } from './utils/logger';

/**
 * 获取应用根目录
 * 优先从 exe 所在目录查找 config/models.yaml，否则使用 cwd
 */
function getAppDir(): string {
  // SEA exe 模式：从可执行文件所在目录查找
  const exeDir = path.dirname(process.execPath);
  if (fs.existsSync(path.join(exeDir, 'config', 'models.yaml'))) {
    return exeDir;
  }
  // 开发模式：使用 cwd
  return process.cwd();
}

/**
 * 校验配置，失败返回 false
 */
function validate(configManager: ConfigManager, logger: Logger): boolean {
  const routes = configManager.getRoutes();

  // 校验路由配置
  if (Object.keys(routes).length === 0) {
    const msg = 'config/models.yaml 中未配置任何路由，请至少添加一个路由。';
    logger.error(msg);
    console.error(`\n[错误] ${msg}\n`);
    return false;
  }

  // 校验 API Key
  for (const [model, route] of Object.entries(routes)) {
    if (!route.apiKey) {
      const msg = `路由 "${model}": apiKey 未配置，请在 .env 或 config/models.yaml 中设置。`;
      logger.error(msg);
      console.error(`\n[错误] ${msg}\n`);
      return false;
    }
    // 检查环境变量是否未解析（仍包含 ${...}）
    if (/\$\{[^}]+\}/.test(route.apiKey)) {
      const envVar = route.apiKey.match(/\$\{([^}]+)\}/)?.[1];
      const msg = `路由 "${model}": 环境变量 "${envVar}" 未设置，请在 .env 文件中配置。`;
      logger.error(msg);
      console.error(`\n[错误] ${msg}\n`);
      return false;
    }
  }

  return true;
}

/**
 * 主入口函数
 * 启动流程：加载配置 -> 校验 -> 创建路由器 -> 启动 HTTP 服务
 * --validate-only 参数：仅校验配置，不启动服务
 */
async function main(): Promise<void> {
  const appDir = getAppDir();
  const configPath = path.join(appDir, 'config', 'models.yaml');
  const validateOnly = process.argv.includes('--validate-only');

  // 初始化配置管理器，读取 models.yaml
  const configManager = new ConfigManager(configPath);
  const config = configManager.getConfig();

  // 初始化日志器
  const logger = new Logger(config.logging);

  // 校验配置
  if (!validate(configManager, logger)) {
    process.exit(1);
  }

  // 仅校验模式，通过后直接退出
  if (validateOnly) {
    console.log('[成功] 配置校验通过。');
    process.exit(0);
  }

  logger.info('Starting AI Proxy server...');

  // 创建路由器（根据模型名查找路由配置）
  const router = new Router(configManager);
  // 创建并启动 HTTP 服务器
  const server = new Server(configManager, router, logger);
  await server.start();

  logger.info('AI Proxy server is ready');
  logger.info(`PID: ${process.pid}`);
  logger.info('Configure Claude Desktop with:');
  logger.info(`ANTHROPIC_BASE_URL=http://${config.server.host}:${config.server.port}`);

  // 输出 PID 供启动脚本读取
  const pidFile = path.join(appDir, '.pid');
  fs.writeFileSync(pidFile, String(process.pid));
}

// 启动服务，失败则退出进程
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
