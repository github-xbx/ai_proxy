import { TransformContext, ClaudeResponse, modelConfigToString, claudeRequestToString, pluginConfigToString } from '../../plugin-sdk/types';
import { Logger } from '../../src/utils/logger';

const logger = new Logger();

// Anthropic 兼容端点，直接透传请求，无需转换格式
export function transformRequest(ctx: TransformContext): any {
  ctx.originalRequest.model = ctx.modelConfig.actualModel; // 替换为实际模型名称

  logger.info(`[DeepSeek] Transforming request for model ${modelConfigToString(ctx.modelConfig)}`);
  logger.info(`[DeepSeek] Transforming request for model ${claudeRequestToString(ctx.originalRequest)}`);
  logger.info(`[DeepSeek] Transforming request for model ${pluginConfigToString(ctx.pluginConfig)}`);

  return ctx.originalRequest;
}

// Anthropic 响应格式已经是 Claude 格式，直接透传
export function transformResponse(ctx: TransformContext, response: any): ClaudeResponse {
  return response as ClaudeResponse;
}

// Anthropic 流式格式已经是 Claude 格式，直接透传
export function transformStreamChunk(ctx: TransformContext, chunk: string): string {
  logger.info(`[DeepSeek] Transforming request for model ${chunk}`);
  
  return chunk;
}
