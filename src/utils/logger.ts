import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export type LogLevelString = 'debug' | 'info' | 'warn' | 'error';

/** 日志级别字符串到枚举的映射 */
const LOG_LEVEL_MAP: Record<LogLevelString, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
};

/**
 * 将字符串日志级别解析为枚举值
 */
function resolveLogLevel(level: LogLevel | LogLevelString): LogLevel {
  if (typeof level === 'string') {
    return LOG_LEVEL_MAP[level] ?? LogLevel.INFO;
  }
  return level;
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 最低日志级别 */
  level: LogLevel;
  /** 是否输出到控制台 */
  console: boolean;
  /** 是否写入文件 */
  file: boolean;
  /** 日志文件目录 */
  logDir: string;
  /** 日志文件名模式（%DATE% 会被替换为日期） */
  filePattern: string;
  /** 日志保留天数 */
  retentionDays: number;
}

/** 日志配置输入类型（level 可以是字符串） */
export type LoggerConfigInput = Omit<LoggerConfig, 'level'> & {
  level: LogLevel | LogLevelString;
};

/**
 * 日志记录器
 * 支持控制台输出和文件输出，按日期自动轮转，自动清理过期日志
 */
export class Logger {
  private config: LoggerConfig;
  /** 当前日期（用于判断是否需要轮转） */
  private currentDate: string = '';
  /** 当前日志文件路径 */
  private currentLogFile: string = '';

  constructor(config: Partial<LoggerConfigInput> = {}) {
    // 合并默认配置
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

    // 如果启用文件日志，确保目录存在并初始化日志文件
    if (this.config.file) {
      this.ensureLogDir();
      this.rotateLogFile();
    }
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * 日志文件轮转 — 日期变化时切换到新文件
   */
  private rotateLogFile(): void {
    const today = new Date().toISOString().split('T')[0];

    if (today !== this.currentDate) {
      const filename = this.config.filePattern.replace('%DATE%', today);
      const filepath = path.join(this.config.logDir, filename);

      this.currentLogFile = filepath;
      this.currentDate = today;

      // 切换日期时清理过期日志
      this.cleanOldLogs();
    }
  }

  /**
   * 清理超过保留天数的旧日志文件
   */
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

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}] ${message}`;

    if (data !== undefined) {
      logLine += ` ${JSON.stringify(data)}`;
    }

    return logLine;
  }

  /**
   * 写入日志
   * @param level 日志级别枚举值
   * @param levelName 日志级别名称
   * @param message 日志消息
   * @param data 附加数据
   */
  private log(level: LogLevel, levelName: string, message: string, data?: any): void {
    // 低于配置级别的日志忽略
    if (this.config.level > level) return;

    const formatted = this.formatMessage(levelName, message, data);

    // 输出到控制台
    if (this.config.console) {
      const consoleFn = level === LogLevel.ERROR ? console.error :
                        level === LogLevel.WARN ? console.warn : console.log;
      consoleFn(formatted);
    }

    // 写入日志文件
    if (this.config.file && this.currentLogFile) {
      this.rotateLogFile();
      fs.appendFileSync(this.currentLogFile, formatted + '\n');
    }
  }

  /** 输出 DEBUG 级别日志 */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  /** 输出 INFO 级别日志 */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  /** 输出 WARN 级别日志 */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  /** 输出 ERROR 级别日志 */
  error(message: string, error?: Error | any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, error);
  }

  /**
   * 获取当前日志文件路径
   */
  getLogFilePath(): string {
    const filename = this.config.filePattern.replace('%DATE%', this.currentDate);
    return path.join(this.config.logDir, filename);
  }
}
