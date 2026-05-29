import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ConfigManager } from './config';
import { PluginManager } from './plugin-manager';
import { Router } from './router';
import { Logger } from './utils/logger';
import { AIPlugin, TransformContext } from '../plugin-sdk/types';
import { ValidationError, NotFoundError } from './types';

export class Server {
  private app: express.Application;
  private config: ConfigManager;
  private pluginManager: PluginManager;
  private router: Router;
  private logger: Logger;

  constructor(config: ConfigManager, pluginManager: PluginManager, router: Router, logger: Logger) {
    this.app = express();
    this.config = config;
    this.pluginManager = pluginManager;
    this.router = router;
    this.logger = logger;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
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
    this.app.use(express.json({ limit: '10mb' }));

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`=== ${req.method} ${req.path} ===`);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.post('/v1/messages', async (req: Request, res: Response) => {
      try {
        const { plugin, modelConfig, request } = await this.router.routeRequest(req);

        this.logger.info(`Routing to plugin: ${plugin.name}, model: ${modelConfig.actualModel}`);

        const pluginConfig = this.config.getPluginConfig(plugin.name);
        if (!pluginConfig) {
          throw new NotFoundError(`Plugin configuration not found for: ${plugin.name}`);
        }

        const transformContext: TransformContext = {
          originalRequest: request,
          modelConfig,
          pluginConfig
        };

        if (request.stream) {
          await this.handleStreamingRequest(plugin, transformContext, res);
        } else {
          await this.handleNonStreamingRequest(plugin, transformContext, res);
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Request failed', err);
        this.logger.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

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

    // Catch-all 404 handler for undefined routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          type: 'not_found_error',
          message: `Route ${req.method} ${req.path} not found`
        }
      });
    });
  }

  private async handleStreamingRequest(
    plugin: AIPlugin,
    ctx: TransformContext,
    res: Response
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const transformedRequest = await plugin.transformRequest(ctx);
    const endpoint = plugin.getEndpoint(ctx);
    const headers = plugin.getHeaders(ctx);
    const timeoutMs = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '30000');
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let clientDisconnected = false;
    const onClose = () => { clientDisconnected = true; };
    res.on('close', onClose);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedRequest),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

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

      // Send message_start event
      res.write(`event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: ctx.modelConfig.claudeModel,
          stop_reason: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })}\n\n`);

      // Send content_block_start event
      res.write(`event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })}\n\n`);

      while (!clientDisconnected) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const transformedChunk = await plugin.transformStreamChunk(ctx, chunk);

        if (transformedChunk) {
          res.write(transformedChunk);
        }
      }

      if (!clientDisconnected) {
        // Send content_block_stop event
        res.write(`event: content_block_stop\ndata: ${JSON.stringify({
          type: 'content_block_stop',
          index: 0
        })}\n\n`);

        // Send message_stop event
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

  private async handleNonStreamingRequest(
    plugin: AIPlugin,
    ctx: TransformContext,
    res: Response
  ): Promise<void> {
    const transformedRequest = await plugin.transformRequest(ctx);
    const endpoint = plugin.getEndpoint(ctx);
    const headers = plugin.getHeaders(ctx);
    const timeoutMs = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '30000');
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedRequest),
        signal: abortController.signal
      });

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

      const data = await response.json();
      const transformedResponse = await plugin.transformResponse(ctx, data);

      res.json(transformedResponse);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', err);

      res.status(500).json({
        error: {
          type: 'internal_error',
          message: 'An unexpected error occurred'
        }
      });
    });
  }

  getApp(): express.Application {
    return this.app;
  }

  async start(): Promise<void> {
    const { port, host } = this.config.getConfig().server;

    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, host, () => {
        this.logger.info(`AI Proxy server running at http://${host}:${port}`);
        this.logger.info(`Loaded ${this.pluginManager.getAllPlugins().length} plugins`);
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
