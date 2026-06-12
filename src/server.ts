import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ConfigManager } from './config';
import { Router } from './router';
import { Logger } from './utils/logger';
import * as transformer from './transformer';
import { ValidationError, NotFoundError } from './types';

/**
 * HTTP 服务器
 * 接收 Claude Desktop 的请求，经路由和转换后转发到第三方 API
 */
export class Server {
  private app: express.Application;
  /** 系统配置 */
  private config: ConfigManager;
  /** 路由器 */
  private router: Router;
  /** 日志记录器 */
  private logger: Logger;

  constructor(config: ConfigManager, router: Router, logger: Logger) {
    this.app = express();
    this.config = config;
    this.router = router;
    this.logger = logger;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 配置中间件：CORS、JSON 解析、请求日志
   */
  private setupMiddleware(): void {
    // CORS 跨域配置，允许 Claude Desktop 访问
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }));
    // JSON 请求体解析，限制 10MB
    this.app.use(express.json({ limit: '10mb' }));

    // 请求日志中间件
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`=== ${req.method} ${req.path} ===`);
      next();
    });
  }

  /**
   * 配置路由
   */
  private setupRoutes(): void {
    // 健康检查端点
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 主端点：Claude 消息请求
    this.app.post('/v1/messages', async (req: Request, res: Response) => {
      try {
        // 路由匹配：根据 model 名称查找路由配置
        const { claudeModel, routeConfig, request } = await this.router.routeRequest(req);

        this.logger.info(`Routing model "${claudeModel}" -> ${routeConfig.protocol}:${routeConfig.targetModel}`);

        // 根据是否流式请求分发处理
        if (request.stream) {
          await this.handleStreamingRequest(claudeModel, routeConfig, request, res);
        } else {
          await this.handleNonStreamingRequest(claudeModel, routeConfig, request, res);
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Request failed', err);
        this.logger.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

        // 根据错误类型返回对应 HTTP 状态码
        if (error instanceof NotFoundError) {
          res.status(404).json({
            error: {
              type: 'invalid_request_error',
              message: err.message
            }
          });
        } else if (error instanceof ValidationError) {
          res.status(400).json({
            error: {
              type: 'invalid_request_error',
              message: err.message
            }
          });
        } else {
          res.status(500).json({
            error: {
              type: 'internal_error',
              message: 'An unexpected error occurred'
            }
          });
        }
      }
    });

    // 未匹配路由的 404 兜底处理
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          type: 'not_found_error',
          message: `Route ${req.method} ${req.path} not found`
        }
      });
    });
  }

  /**
   * 处理流式请求（SSE）
   * 1. 转换请求体并发送到上游 API
   * 2. 逐块读取上游响应并转换格式
   * 3. 以 Claude SSE 事件格式写回客户端
   */
  private async handleStreamingRequest(
    claudeModel: string,
    routeConfig: import('./types').RouteConfig,
    request: import('./types').ClaudeRequest,
    res: Response
  ): Promise<void> {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 转换请求并获取上游端点和请求头
    const transformedRequest = transformer.transformRequest(routeConfig, request);
    const endpoint = transformer.getEndpoint(routeConfig);
    const headers = transformer.getHeaders(routeConfig);

    // 超时控制
    const timeoutMs = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '30000');
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // 客户端断开连接检测
    let clientDisconnected = false;
    const onClose = () => { clientDisconnected = true; };
    res.on('close', onClose);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      // 发送请求到上游 API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedRequest),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      // 上游返回错误
      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`API error: ${response.status}`, error);
        res.status(response.status).json({
          error: {
            type: 'api_error',
            message: `Third-party API error: ${response.status}`
          }
        });
        return;
      }

      reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // 发送 message_start 事件（Claude SSE 协议要求）
      res.write(`event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: claudeModel,
          stop_reason: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })}\n\n`);

      // 发送 content_block_start 事件
      res.write(`event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })}\n\n`);

      // 循环读取上游流式响应，逐块转换并写入客户端
      while (!clientDisconnected) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const transformedChunk = transformer.transformStreamChunk(routeConfig, chunk);

        if (transformedChunk) {
          res.write(transformedChunk);
        }
      }

      // 客户端未断开，发送结束事件
      if (!clientDisconnected) {
        // 发送 content_block_stop 事件
        res.write(`event: content_block_stop\ndata: ${JSON.stringify({
          type: 'content_block_stop',
          index: 0
        })}\n\n`);

        // 发送 message_stop 事件
        res.write(`event: message_stop\ndata: ${JSON.stringify({
          type: 'message_stop'
        })}\n\n`);

        res.end();
      }
    } catch (error) {
      this.logger.error('Stream error', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            type: 'internal_error',
            message: 'Stream processing failed'
          }
        });
      }
    } finally {
      clearTimeout(timeoutId);
      reader?.cancel().catch(() => {});
      res.removeListener('close', onClose);
    }
  }

  /**
   * 处理非流式请求
   * 转换请求体 -> 发送到上游 -> 转换响应体 -> 返回给客户端
   */
  private async handleNonStreamingRequest(
    claudeModel: string,
    routeConfig: import('./types').RouteConfig,
    request: import('./types').ClaudeRequest,
    res: Response
  ): Promise<void> {
    const transformedRequest = transformer.transformRequest(routeConfig, request);
    const endpoint = transformer.getEndpoint(routeConfig);
    const headers = transformer.getHeaders(routeConfig);

    // 超时控制
    const timeoutMs = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '30000');
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      // 发送请求到上游 API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedRequest),
        signal: abortController.signal
      });

      // 上游返回错误
      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`API error: ${response.status}`, error);
        res.status(response.status).json({
          error: {
            type: 'api_error',
            message: `Third-party API error: ${response.status}`
          }
        });
        return;
      }

      // 解析上游响应并转换为 Claude 格式
      const data = await response.json();
      const transformedResponse = transformer.transformResponse(routeConfig, data, claudeModel);

      res.json(transformedResponse);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 全局错误处理中间件
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('Unhandled error', err);

      res.status(500).json({
        error: {
          type: 'internal_error',
          message: 'An unexpected error occurred'
        }
      });
    });
  }

  /**
   * 获取 Express 应用实例（用于测试）
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    const { port, host } = this.config.getConfig().server;

    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, host, () => {
        this.logger.info(`AI Proxy server running at http://${host}:${port}`);
        const routeCount = Object.keys(this.config.getRoutes()).length;
        this.logger.info(`Loaded ${routeCount} routes`);
        resolve();
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(err);
        }
      });
    });
  }
}
