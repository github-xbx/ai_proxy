import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export type LogLevelString = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_MAP: Record<LogLevelString, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
};

function resolveLogLevel(level: LogLevel | LogLevelString): LogLevel {
  if (typeof level === 'string') {
    return LOG_LEVEL_MAP[level] ?? LogLevel.INFO;
  }
  return level;
}

export interface LoggerConfig {
  level: LogLevel;
  console: boolean;
  file: boolean;
  logDir: string;
  filePattern: string;
  retentionDays: number;
}

export type LoggerConfigInput = Omit<LoggerConfig, 'level'> & {
  level: LogLevel | LogLevelString;
};

export class Logger {
  private config: LoggerConfig;
  private currentDate: string = '';
  private currentLogFile: string = '';

  constructor(config: Partial<LoggerConfigInput> = {}) {
    const merged = {
      level: LogLevel.INFO,
      console: true,
      file: true,
      logDir: path.join(process.cwd(), 'logs'),
      filePattern: 'ai-proxy-%DATE%.log',
      retentionDays: 7,
      ...config
    };
    this.config = { ...merged, level: resolveLogLevel(merged.level) };

    if (this.config.file) {
      this.ensureLogDir();
      this.rotateLogFile();
    }
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private rotateLogFile(): void {
    const today = new Date().toISOString().split('T')[0];

    if (today !== this.currentDate) {
      const filename = this.config.filePattern.replace('%DATE%', today);
      const filepath = path.join(this.config.logDir, filename);

      this.currentLogFile = filepath;
      this.currentDate = today;

      this.cleanOldLogs();
    }
  }

  private cleanOldLogs(): void {
    const files = fs.readdirSync(this.config.logDir);
    const now = Date.now();
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filepath = path.join(this.config.logDir, file);
      const stat = fs.statSync(filepath);

      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
      }
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}] ${message}`;

    if (data !== undefined) {
      logLine += ` ${JSON.stringify(data)}`;
    }

    return logLine;
  }

  private log(level: LogLevel, levelName: string, message: string, data?: any): void {
    if (this.config.level > level) return;

    const formatted = this.formatMessage(levelName, message, data);

    if (this.config.console) {
      const consoleFn = level === LogLevel.ERROR ? console.error :
                        level === LogLevel.WARN ? console.warn : console.log;
      consoleFn(formatted);
    }

    if (this.config.file && this.currentLogFile) {
      this.rotateLogFile();
      fs.appendFileSync(this.currentLogFile, formatted + '\n');
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  error(message: string, error?: Error | any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, error);
  }

  getLogFilePath(): string {
    const filename = this.config.filePattern.replace('%DATE%', this.currentDate);
    return path.join(this.config.logDir, filename);
  }
}
