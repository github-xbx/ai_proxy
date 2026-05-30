/*==========================================*/
/*                自定以类型                 */
/*==========================================*/


/**
 * 模型配置
 */
export interface ModelConfig {
  claudeModel: string;
  actualModel: string;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
}

/**
 * 插件配置，
 * 插件试集成
 */
export interface PluginConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelConfig[];
}

/**
 * 服务配置
 */
export interface ServerConfig {
  port: number;
  host: string;
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  console: boolean;
  file: boolean;
  logDir: string;
  filePattern: string;
  retentionDays: number;
}

/**
 * models.yaml 配置实体
 */
export interface AppConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  plugins: Record<string, PluginConfig>;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface TransformContext {
  originalRequest: ClaudeRequest;
  modelConfig: ModelConfig;
  pluginConfig: PluginConfig;
}

export interface APIError {
  type: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
