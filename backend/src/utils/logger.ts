/**
 * Logger utility for consistent logging across the application
 * Supports different log levels and structured logging
 */

import { config } from '../config';

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Main logger class
 */
class Logger {
  private level: LogLevel;
  
  constructor() {
    // Set log level based on environment
    this.level = this.getLogLevelFromEnv();
  }
  
  /**
   * Determine log level from environment
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    
    switch (envLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        // Default to INFO in production, DEBUG in development
        return config.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }
  
  /**
   * Format log entry
   */
  private formatLogEntry(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  }
  
  /**
   * Log error message
   */
  error(message: string, meta?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatLogEntry('error', message, meta));
    }
  }
  
  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatLogEntry('warn', message, meta));
    }
  }
  
  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.info(this.formatLogEntry('info', message, meta));
    }
  }
  
  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.formatLogEntry('debug', message, meta));
    }
  }
}

// Export singleton instance
export const logger = new Logger();