import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import dotenv from 'dotenv';
import { AppConfig, RouteConfig } from './types';

/**
 * YAML 中的原始路由配置（未解析环境变量）
 */
interface RawRouteConfig {
  targetModel?: string;
  protocol?: string;
  baseUrl?: string;
  apiKey?: string;
  streaming?: boolean;
}

// 加载 .env 环境变量
// 优先从 exe 所在目录查找，再从 cwd 查找
const exeDir = path.dirname(process.execPath);
const exeEnvPath = path.join(exeDir, '.env');
if (fs.existsSync(exeEnvPath)) {
  dotenv.config({ path: exeEnvPath });
} else {
  dotenv.config();
}

/**
 * 配置管理器
 * 负责读取 models.yaml 并解析为 AppConfig，支持 ${ENV_VAR} 环境变量替换
 */
export class ConfigManager {
  private config: AppConfig;

  /**
   * @param configPath models.yaml 文件路径
   */
  constructor(configPath: string) {
    // 读取并解析 YAML 配置文件
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = yaml.parse(fileContent);

    // 构建基础配置
    this.config = {
      server: {
        port: parseInt(process.env.PORT || rawConfig.server?.port?.toString() || '3000'),
        host: process.env.HOST || rawConfig.server?.host || 'localhost'
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || rawConfig.logging?.level || 'info',
        console: rawConfig.logging?.console !== false,
        file: process.env.LOG_TO_FILE !== 'false' && rawConfig.logging?.file !== false,
        logDir: process.env.LOG_DIR || rawConfig.logging?.logDir || './logs',
        filePattern: rawConfig.logging?.filePattern || 'ai-proxy-%DATE%.log',
        retentionDays: rawConfig.logging?.retentionDays || 7
      },
      routes: {}
    };

    // 遍历 routes 配置，解析环境变量并填充默认值
    for (const [claudeModel, routeRaw] of Object.entries(rawConfig.routes || {})) {
      const route = routeRaw as RawRouteConfig;

      this.config.routes[claudeModel] = {
        targetModel: route.targetModel || claudeModel,
        protocol: (route.protocol as RouteConfig['protocol']) || 'anthropic',
        baseUrl: this.resolveEnvVars(route.baseUrl),
        apiKey: this.resolveEnvVars(route.apiKey),
        streaming: route.streaming !== false
      };
    }
  }

  /**
   * 替换字符串中的 ${ENV_VAR} 为实际环境变量值
   */
  private resolveEnvVars(value: string | undefined): string {
    if (!value) return '';

    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }

  /**
   * 获取完整配置
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * 根据 Claude 模型名查找路由配置
   * @param claudeModel Claude 模型名称（如 claude-sonnet-4-5）
   */
  getRoute(claudeModel: string): RouteConfig | undefined {
    return this.config.routes[claudeModel];
  }

  /**
   * 获取所有路由配置
   */
  getRoutes(): Record<string, RouteConfig> {
    return this.config.routes;
  }
}
