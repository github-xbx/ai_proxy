import { TransformContext, ClaudeResponse, modelConfigToString } from '../../plugin-sdk/types';
import { Logger } from '../../src/utils/logger';

const logger = new Logger();

// Anthropic 兼容端点，直接透传请求，无需转换格式
export function transformRequest(ctx: TransformContext): any {
  ctx.originalRequest.model = ctx.modelConfig.actualModel; // 替换为实际模型名称
  logger.info(`[MiMo] Transforming request for model ${modelConfigToString(ctx.modelConfig)}`);
  return ctx.originalRequest;
}

// Anthropic 响应格式已经是 Claude 格式，直接透传
export function transformResponse(ctx: TransformContext, response: any): ClaudeResponse {
  return response as ClaudeResponse;
}

// Anthropic 流式格式已经是 Claude 格式，直接透传
export function transformStreamChunk(ctx: TransformContext, chunk: string): string {
  return chunk;
}
