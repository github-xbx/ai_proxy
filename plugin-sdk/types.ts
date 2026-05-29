// Standalone type definitions so plugin-sdk does not depend on src/types
export interface ModelConfig {
  claudeModel: string;
  actualModel: string;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
}

export interface PluginConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelConfig[];
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | { type: string; text?: string }[];
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

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
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

// toString 工具函数 - 用于打印调试
export function modelConfigToString(config: ModelConfig): string {
  return `ModelConfig { claudeModel: "${config.claudeModel}", actualModel: "${config.actualModel}", maxTokens: ${config.maxTokens}, supportsVision: ${config.supportsVision}, supportsStreaming: ${config.supportsStreaming} }`;
}

export function pluginConfigToString(config: PluginConfig): string {
  const maskedApiKey = config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'undefined';
  return `PluginConfig { name: "${config.name}", baseUrl: "${config.baseUrl}", apiKey: "${maskedApiKey}", models: [${config.models.length} models] }`;
}

export function claudeRequestToString(request: ClaudeRequest): string {
  let systemStr = 'undefined';
  if (request.system) {
    if (typeof request.system === 'string') {
      systemStr = `"${request.system.substring(0, 50)}..."`;
    } else {
      systemStr = JSON.stringify(request.system).substring(0, 50) + '...';
    }
  }
  return `ClaudeRequest { model: "${request.model}", max_tokens: ${request.max_tokens}, messages: [${request.messages.length} messages], system: ${systemStr}, stream: ${request.stream}, temperature: ${request.temperature}, top_p: ${request.top_p} }`;
}

export interface AIPlugin {
  name: string;
  version: string;
  description: string;

  initialize(config: PluginConfig): Promise<void>;
  getModelMapping(): ModelConfig[];
  transformRequest(ctx: TransformContext): Promise<any>;
  transformResponse(ctx: TransformContext, response: any): Promise<any>;
  transformStreamChunk(ctx: TransformContext, chunk: string): Promise<string>;
  getEndpoint(ctx: TransformContext): string;
  getHeaders(ctx: TransformContext): Record<string, string>;
}
