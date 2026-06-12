import { RouteConfig, ClaudeRequest, ClaudeResponse } from './types';

/**
 * 根据协议类型构建上游 API 端点地址
 * - anthropic: {baseUrl}/v1/messages
 * - openai:    {baseUrl}/chat/completions
 */
export function getEndpoint(routeConfig: RouteConfig): string {
  if (routeConfig.protocol === 'openai') {
    return `${routeConfig.baseUrl}/chat/completions`;
  }
  return `${routeConfig.baseUrl}/v1/messages`;
}

/**
 * 根据协议类型构建请求头
 * - anthropic: 使用 x-api-key + anthropic-version
 * - openai:    使用 Authorization: Bearer
 */
export function getHeaders(routeConfig: RouteConfig): Record<string, string> {
  if (routeConfig.protocol === 'openai') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${routeConfig.apiKey}`
    };
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': `${routeConfig.apiKey}`,
    'anthropic-version': '2023-06-01'
  };
}

/**
 * 转换请求体
 * 根据协议类型分发到对应的转换函数
 */
export function transformRequest(routeConfig: RouteConfig, request: ClaudeRequest): any {
  if (routeConfig.protocol === 'openai') {
    return transformRequestToOpenAI(routeConfig, request);
  }
  return transformRequestToAnthropic(routeConfig, request);
}

/**
 * 转换响应体
 * anthropic 协议直接透传，openai 协议需要转换为 Claude 格式
 */
export function transformResponse(routeConfig: RouteConfig, response: any, claudeModel: string): ClaudeResponse {
  if (routeConfig.protocol === 'openai') {
    return transformResponseFromOpenAI(response, claudeModel);
  }
  return response as ClaudeResponse;
}

/**
 * 转换流式响应块
 * anthropic 协议直接透传，openai 协议需要转换 SSE 事件格式
 */
export function transformStreamChunk(routeConfig: RouteConfig, chunk: string): string {
  if (routeConfig.protocol === 'openai') {
    return transformStreamChunkFromOpenAI(chunk);
  }
  return chunk;
}

// ============================================================
//  Anthropic 兼容协议（DeepSeek、MiMo 等）
//  这些后端原生支持 Anthropic 格式，只需替换模型名即可
// ============================================================

/**
 * Anthropic 协议请求转换 — 直接透传，仅替换模型名
 */
function transformRequestToAnthropic(routeConfig: RouteConfig, request: ClaudeRequest): any {
  return {
    ...request,
    model: routeConfig.targetModel
  };
}

// ============================================================
//  OpenAI 兼容协议
//  需要在 Claude 格式和 OpenAI chat/completions 格式之间转换
// ============================================================

/**
 * OpenAI 协议请求转换
 * 将 Claude 消息格式转换为 OpenAI chat/completions 格式：
 * - 提取 system 提示词为独立的 system 消息
 * - 展平 content 数组为纯文本
 */
function transformRequestToOpenAI(routeConfig: RouteConfig, request: ClaudeRequest): any {
  const messages: any[] = [];

  // 将 Claude 的 system 字段转为 OpenAI 的 system 消息
  if (request.system) {
    messages.push({ role: 'system', content: request.system });
  }

  if (!Array.isArray(request.messages)) {
    throw new Error('Invalid request: messages must be an array');
  }

  // 转换每条消息，将 content 数组展平为纯文本
  for (const msg of request.messages) {
    messages.push({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
    });
  }

  return {
    model: routeConfig.targetModel,
    max_tokens: request.max_tokens,
    messages,
    stream: request.stream || false,
    temperature: request.temperature,
    top_p: request.top_p
  };
}

/**
 * OpenAI 协议响应转换
 * 将 OpenAI 响应格式转换为 Claude 响应格式：
 * - choices[0].message.content -> content[{type:"text", text}]
 * - finish_reason -> stop_reason
 * - usage 字段重命名
 */
function transformResponseFromOpenAI(response: any, claudeModel: string): ClaudeResponse {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Invalid response: missing choices');
  }

  return {
    id: response.id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: response.choices[0].message.content }],
    model: claudeModel,
    stop_reason: response.choices[0].finish_reason === 'stop' ? 'end_turn' : 'max_tokens',
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0
    }
  };
}

/**
 * OpenAI 协议流式响应块转换
 * 将 OpenAI SSE 格式转换为 Claude SSE 格式：
 * - data: {choices[0].delta.content} -> event: content_block_delta
 * - data: [DONE] -> event: message_stop
 */
function transformStreamChunkFromOpenAI(chunk: string): string {
  const lines = chunk.split('\n');
  let result = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);

      // 流结束标记
      if (data === '[DONE]') {
        result += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        // 将 OpenAI 的 delta 内容转为 Claude 的 content_block_delta 事件
        if (delta?.content) {
          result += `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: delta.content }
          })}\n\n`;
        }
      } catch (e) {
        // 跳过无法解析的 JSON 行
      }
    }
  }

  return result;
}
