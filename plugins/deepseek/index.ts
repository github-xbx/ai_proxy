import { BasePlugin } from '../../plugin-sdk';
import { PluginConfig, ModelConfig, TransformContext } from '../../plugin-sdk/types';
import { transformRequest, transformResponse, transformStreamChunk } from './transformer';
import modelsConfig from './models.json';

export class DeepSeekPlugin extends BasePlugin {
  name = 'deepseek';
  version = '1.0.0';
  description = 'DeepSeek AI model plugin';

  getModelMapping(): ModelConfig[] {
    return this.config?.models || modelsConfig;
  }

  async transformRequest(ctx: TransformContext): Promise<any> {
    return transformRequest(ctx);
  }

  async transformResponse(ctx: TransformContext, response: any): Promise<any> {
    return transformResponse(ctx, response);
  }

  async transformStreamChunk(ctx: TransformContext, chunk: string): Promise<string> {
    return transformStreamChunk(ctx, chunk);
  }

  getEndpoint(ctx: TransformContext): string {
    return `${this.config?.baseUrl}/v1/messages`;
  }

  getHeaders(ctx: TransformContext): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': `${this.config?.apiKey}`,
      'anthropic-version': '2023-06-01'
    };
  }
}

export default new DeepSeekPlugin();
