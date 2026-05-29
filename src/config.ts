import fs from 'fs';
import yaml from 'yaml';
import dotenv from 'dotenv';
import { AppConfig, PluginConfig } from './types';

interface RawPluginConfig {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  models?: any[];
}

dotenv.config();

export class ConfigManager {
  private config: AppConfig;

  constructor(configPath: string) {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = yaml.parse(fileContent);

    this.config = {
      server: {
        port: parseInt(process.env.PORT || rawConfig.server?.port?.toString() || '3000'),
        host: process.env.HOST || rawConfig.server?.host || 'localhost'
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || rawConfig.logging?.level || 'info',
        console: rawConfig.logging?.console !== false,
        file: process.env.LOG_TO_FILE !== 'false' && rawConfig.logging?.file !== false,
        logDir: process.env.LOG_DIR || rawConfig.logging?.logDir || './logs',
        filePattern: rawConfig.logging?.filePattern || 'ai-proxy-%DATE%.log',
        retentionDays: rawConfig.logging?.retentionDays || 7
      },
      plugins: {}
    };

    for (const [name, pluginRaw] of Object.entries(rawConfig.plugins || {})) {
      const plugin = pluginRaw as RawPluginConfig;

      if (plugin.enabled !== false) {
        this.config.plugins[name] = {
          name,
          baseUrl: this.resolveEnvVars(plugin.baseUrl),
          apiKey: this.resolveEnvVars(plugin.apiKey),
          models: plugin.models || []
        };
      }
    }
  }

  private resolveEnvVars(value: string | undefined): string {
    if (!value) return '';

    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getPluginConfig(pluginName: string): PluginConfig | undefined {
    return this.config.plugins[pluginName];
  }

  getPlugins(): Record<string, PluginConfig> {
    return this.config.plugins;
  }
}
