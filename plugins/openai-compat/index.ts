import { BasePlugin } from '../../plugin-sdk';
import { PluginConfig, ModelConfig, TransformContext } from '../../plugin-sdk/types';
import { transformRequest, transformResponse, transformStreamChunk } from './transformer';
import modelsConfig from './models.json';

export class OpenAICompatPlugin extends BasePlugin {
  name = 'openai-compat';
  version = '1.0.0';
  description = 'OpenAI compatible API plugin';

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
    if (!this.config) {
      throw new Error(
        `Plugin "${this.name}" has not been initialized. Call initialize() before using getEndpoint().`
      );
    }
    return `${this.config.baseUrl}/chat/completions`;
  }
}

export default new OpenAICompatPlugin();
