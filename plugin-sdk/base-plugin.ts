import { AIPlugin, PluginConfig, ModelConfig, TransformContext, ClaudeRequest } from './types';

export abstract class BasePlugin implements AIPlugin {
  abstract name: string;
  abstract version: string;
  abstract description: string;

  protected config: PluginConfig | null = null;

  async initialize(config: PluginConfig): Promise<void> {
    this.config = config;
  }

  abstract getModelMapping(): ModelConfig[];
  abstract transformRequest(ctx: TransformContext): Promise<any>;
  abstract transformResponse(ctx: TransformContext, response: any): Promise<any>;
  abstract transformStreamChunk(ctx: TransformContext, chunk: string): Promise<string>;
  abstract getEndpoint(ctx: TransformContext): string;

  getHeaders(ctx: TransformContext): Record<string, string> {
    if (!this.config) {
      throw new Error(
        `Plugin "${this.name}" has not been initialized. Call initialize() before using getHeaders().`
      );
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  protected transformMessages(messages: any[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
    }));
  }

  protected extractSystemPrompt(request: ClaudeRequest): string | undefined {
    return request.system;
  }
}
