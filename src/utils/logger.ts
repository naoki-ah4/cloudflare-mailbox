/**
 * Logger utility for Cloudflare Workers
 * Provides structured logging with different log levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  userId?: string
  action?: string
  error?: Error
}

class Logger {
  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, userId, action, error } = entry
    
    const logData = {
      timestamp,
      level,
      message,
      ...(userId && { userId }),
      ...(action && { action }),
      ...(context && { context }),
      ...(error && { 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    }

    return JSON.stringify(logData)
  }

  private createLogEntry(level: LogLevel, message: string, options?: {
    context?: Record<string, unknown>
    userId?: string
    action?: string
    error?: Error
  }): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options
    }
  }

  debug(message: string, options?: { context?: Record<string, unknown>; userId?: string; action?: string }) {
    const entry = this.createLogEntry('debug', message, options)
    console.log(this.formatLog(entry))
  }

  info(message: string, options?: { context?: Record<string, unknown>; userId?: string; action?: string }) {
    const entry = this.createLogEntry('info', message, options)
    console.log(this.formatLog(entry))
  }

  warn(message: string, options?: { context?: Record<string, unknown>; userId?: string; action?: string }) {
    const entry = this.createLogEntry('warn', message, options)
    console.warn(this.formatLog(entry))
  }

  error(message: string, options?: { context?: Record<string, unknown>; userId?: string; action?: string; error?: Error }) {
    const entry = this.createLogEntry('error', message, options)
    console.error(this.formatLog(entry))
  }

  // Specific logging methods for common use cases
  authLog(message: string, userId?: string, context?: Record<string, unknown>) {
    this.info(message, { userId, action: 'auth', context })
  }

  emailLog(message: string, context?: Record<string, unknown>) {
    this.info(message, { action: 'email', context })
  }

  adminLog(message: string, userId?: string, context?: Record<string, unknown>) {
    this.info(message, { userId, action: 'admin', context })
  }

  securityLog(message: string, context?: Record<string, unknown>) {
    this.warn(message, { action: 'security', context })
  }

  performanceLog(message: string, context?: Record<string, unknown>) {
    this.info(message, { action: 'performance', context })
  }
}

export const logger = new Logger()