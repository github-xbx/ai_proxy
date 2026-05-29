import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config';
import { AIPlugin } from '../plugin-sdk/types';
import { ModelConfig } from './types';

export class PluginManager {
  private plugins: Map<string, AIPlugin> = new Map();
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  async discoverPlugins(): Promise<void> {
    const pluginsDir = path.join(__dirname, '../plugins');

    if (!fs.existsSync(pluginsDir)) {
      console.warn('Plugins directory not found');
      return;
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(pluginsDir, entry.name);
        await this.loadPlugin(pluginPath, entry.name);
      }
    }
  }

  static validatePlugin(obj: unknown, pluginName: string): asserts obj is AIPlugin {
    const requiredProps = ['name', 'version', 'description'];
    const requiredMethods = [
      'initialize',
      'getModelMapping',
      'transformRequest',
      'transformResponse',
      'transformStreamChunk',
      'getEndpoint',
      'getHeaders',
    ];

    if (typeof obj !== 'object' || obj === null) {
      throw new Error(`Plugin "${pluginName}" must export an object, got ${typeof obj}`);
    }

    const record = obj as Record<string, unknown>;

    for (const prop of requiredProps) {
      if (typeof record[prop] !== 'string') {
        throw new Error(
          `Plugin "${pluginName}" is missing required string property "${prop}"`,
        );
      }
    }

    for (const method of requiredMethods) {
      if (typeof record[method] !== 'function') {
        throw new Error(
          `Plugin "${pluginName}" is missing required method "${method}"`,
        );
      }
    }
  }

  private async loadPlugin(pluginPath: string, pluginName: string): Promise<void> {
    try {
      const pluginModule = await import(pluginPath);
      const pluginCandidate = pluginModule.default || pluginModule;

      PluginManager.validatePlugin(pluginCandidate, pluginName);

      const pluginConfig = this.config.getPluginConfig(pluginName);

      if (pluginConfig) {
        await pluginCandidate.initialize(pluginConfig);
        this.plugins.set(pluginName, pluginCandidate);
        console.log(`Loaded plugin: ${pluginCandidate.name} v${pluginCandidate.version}`);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error);
    }
  }

  getPlugin(name: string): AIPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): AIPlugin[] {
    return Array.from(this.plugins.values());
  }

  findPluginForModel(claudeModel: string): { plugin: AIPlugin; modelConfig: ModelConfig } | null {
    for (const plugin of this.plugins.values()) {
      const modelConfig = plugin.getModelMapping().find(m => m.claudeModel === claudeModel);

      if (modelConfig) {
        return { plugin, modelConfig };
      }
    }

    return null;
  }
}
