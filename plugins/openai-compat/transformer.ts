import { TransformContext, ClaudeResponse } from '../../plugin-sdk/types';

export function transformRequest(ctx: TransformContext): any {
  const { originalRequest } = ctx;
  const messages: any[] = [];

  if (originalRequest.system) {
    messages.push({ role: 'system', content: originalRequest.system });
  }

  if (!Array.isArray(originalRequest.messages)) {
    throw new Error('Invalid request: messages must be an array');
  }

  for (const msg of originalRequest.messages) {
    messages.push({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
    });
  }

  return {
    model: ctx.modelConfig.actualModel,
    max_tokens: originalRequest.max_tokens,
    messages,
    stream: originalRequest.stream || false,
    temperature: originalRequest.temperature,
    top_p: originalRequest.top_p
  };
}

export function transformResponse(ctx: TransformContext, response: any): ClaudeResponse {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Invalid response: missing choices');
  }

  return {
    id: response.id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: response.choices[0].message.content }],
    model: ctx.modelConfig.claudeModel,
    stop_reason: response.choices[0].finish_reason === 'stop' ? 'end_turn' : 'max_tokens',
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0
    }
  };
}

export function transformStreamChunk(ctx: TransformContext, chunk: string): string {
  const lines = chunk.split('\n');
  let result = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);

      if (data === '[DONE]') {
        result += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) {
          result += `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: delta.content }
          })}\n\n`;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  return result;
}
