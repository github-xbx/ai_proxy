import { Request } from 'express';
import { ConfigManager } from './config';
import { RouteConfig, ClaudeRequest, ValidationError, NotFoundError } from './types';

/**
 * 路由匹配结果
 */
export interface RouteResult {
  /** 原始请求中的 Claude 模型名 */
  claudeModel: string;
  /** 匹配到的路由配置 */
  routeConfig: RouteConfig;
  /** 解析后的请求体 */
  request: ClaudeRequest;
}

/**
 * 路由器
 * 根据请求中的 model 字段查找对应的路由配置
 */
export class Router {
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  /**
   * 获取支持的路由列表
   */
  getRoutes(): Record<string, string> {
    return {
      '/v1/messages': 'POST'
    };
  }

  /**
   * 路由请求
   * 从请求体中提取 model 字段，在配置中查找对应的路由
   *
   * @throws ValidationError 请求体或 model 字段缺失
   * @throws NotFoundError 找不到对应的路由配置
   */
  async routeRequest(req: Request): Promise<RouteResult> {
    if (!req.body) {
      throw new ValidationError('Request body is required');
    }

    const { model } = req.body;

    if (!model) {
      throw new ValidationError('Model is required');
    }

    // 根据 Claude 模型名查找路由配置
    const routeConfig = this.config.getRoute(model);

    if (!routeConfig) {
      throw new NotFoundError(`No route found for model: ${model}`);
    }

    return {
      claudeModel: model,
      routeConfig,
      request: req.body as ClaudeRequest
    };
  }
}
