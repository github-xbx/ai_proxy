import { Logger, LogLevel } from '../../src/utils/logger';
import fs from 'fs';
import path from 'path';

describe('Logger', () => {
  const testLogDir = path.join(__dirname, '../../logs-test');

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true });
    }
  });

  test('should create logger with default config', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  test('should log to console when console is enabled', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const logger = new Logger({ level: LogLevel.DEBUG, console: true, file: false });

    logger.info('Test message');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    consoleSpy.mockRestore();
  });

  test('should not log when level is higher', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const logger = new Logger({ level: LogLevel.WARN, console: true, file: false });

    logger.info('Test message');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should write to file when file logging is enabled', () => {
    const logger = new Logger({
      level: LogLevel.DEBUG,
      console: false,
      file: true,
      logDir: testLogDir
    });

    logger.info('Test file message');

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(testLogDir, `ai-proxy-${today}.log`);
    expect(fs.existsSync(logFile)).toBe(true);

    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('Test file message');
  });

  test('should accept string-based log level', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const logger = new Logger({ level: 'debug', console: true, file: false });

    logger.debug('String level message');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('String level message'));
    consoleSpy.mockRestore();
  });

  test('should filter messages correctly with string-based level', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const logger = new Logger({ level: 'warn', console: true, file: false });

    logger.info('Should not appear');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should accept LoggingConfig with string level directly', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    // Simulates passing LoggingConfig from types.ts directly
    const loggingConfig = {
      level: 'info' as const,
      console: true,
      file: false,
      logDir: testLogDir,
      filePattern: 'test-%DATE%.log',
      retentionDays: 7
    };
    const logger = new Logger(loggingConfig);

    logger.info('LoggingConfig message');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('LoggingConfig message'));
    consoleSpy.mockRestore();
  });
});
