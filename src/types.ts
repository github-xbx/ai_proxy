/*==========================================*/
/*                自定义类型                 */
/*==========================================*/

/**
 * 路由配置 — 每个 Claude 模型名对应一个后端路由
 * 通过 protocol 字段区分 Anthropic 兼容和 OpenAI 兼容两种协议
 */
export interface RouteConfig {
  /** 目标模型名称（实际发送给后端 API 的模型名） */
  targetModel: string;
  /** 协议类型：anthropic 直通 / openai 需要格式转换 */
  protocol: 'anthropic' | 'openai';
  /** 后端 API 基础地址 */
  baseUrl: string;
  /** API 密钥 */
  apiKey?: string;
  /** 是否支持流式响应 */
  streaming?: boolean;
}

/**
 * 服务配置
 */
export interface ServerConfig {
  /** 监听端口 */
  port: number;
  /** 监听地址 */
  host: string;
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 是否输出到控制台 */
  console: boolean;
  /** 是否写入文件 */
  file: boolean;
  /** 日志文件目录 */
  logDir: string;
  /** 日志文件名模式 */
  filePattern: string;
  /** 日志保留天数 */
  retentionDays: number;
}

/**
 * models.yaml 配置实体
 */
export interface AppConfig {
  /** 服务配置 */
  server: ServerConfig;
  /** 日志配置 */
  logging: LoggingConfig;
  /** 路由映射表：Claude 模型名 -> 路由配置 */
  routes: Record<string, RouteConfig>;
}

/**
 * Claude 消息
 */
export interface ClaudeMessage {
  /** 角色：user 或 assistant */
  role: 'user' | 'assistant';
  /** 消息内容：纯文本或内容块数组 */
  content: string | ContentBlock[];
}

/**
 * 内容块（支持文本和图片）
 */
export interface ContentBlock {
  /** 内容类型 */
  type: 'text' | 'image';
  /** 文本内容（type=text 时使用） */
  text?: string;
  /** 图片源（type=image 时使用） */
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Claude API 请求体
 */
export interface ClaudeRequest {
  /** 模型名称 */
  model: string;
  /** 最大输出 token 数 */
  max_tokens: number;
  /** 消息列表 */
  messages: ClaudeMessage[];
  /** 系统提示词 */
  system?: string;
  /** 是否启用流式响应 */
  stream?: boolean;
  /** 温度参数 */
  temperature?: number;
  /** top_p 参数 */
  top_p?: number;
}

/**
 * Claude API 响应体
 */
export interface ClaudeResponse {
  /** 消息 ID */
  id: string;
  /** 固定为 message */
  type: 'message';
  /** 角色 */
  role: 'assistant';
  /** 响应内容 */
  content: ContentBlock[];
  /** 模型名称 */
  model: string;
  /** 停止原因 */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  /** token 用量 */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 转换上下文 — 传递给转换器的运行时信息
 */
export interface TransformContext {
  /** 原始 Claude 请求 */
  originalRequest: ClaudeRequest;
  /** 原始请求中的 Claude 模型名 */
  claudeModel: string;
  /** 匹配到的路由配置 */
  routeConfig: RouteConfig;
}

/**
 * API 错误响应
 */
export interface APIError {
  /** 错误类型 */
  type: string;
  /** 错误信息 */
  message: string;
}

/**
 * 请求校验错误（400）
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 路由未找到错误（404）
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
