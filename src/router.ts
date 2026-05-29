import { Request } from 'express';
import { PluginManager } from './plugin-manager';
import { AIPlugin } from '../plugin-sdk/types';
import { ModelConfig, ClaudeRequest, ValidationError, NotFoundError } from './types';

export interface RouteResult {
  plugin: AIPlugin;
  modelConfig: ModelConfig;
  request: ClaudeRequest;
}

export class Router {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  getRoutes(): Record<string, string> {
    return {
      '/v1/messages': 'POST'
    };
  }

  async routeRequest(req: Request): Promise<RouteResult> {
    if (!req.body) {
      throw new ValidationError('Request body is required');
    }

    const { model } = req.body;

    if (!model) {
      throw new ValidationError('Model is required');
    }

    const result = this.pluginManager.findPluginForModel(model);

    if (!result) {
      throw new NotFoundError(`No plugin found for model: ${model}`);
    }

    return {
      plugin: result.plugin,
      modelConfig: result.modelConfig,
      request: req.body as ClaudeRequest
    };
  }
}
