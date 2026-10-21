import { LoggerService } from '@nestjs/common';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SENSITIVE = /(pass(word)?|secret|token|cookie|authorization|csrf|hash|session)/i;

/** Recursively redacts values whose key looks sensitive. Exported for tests and the audit service. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

/** Minimal structured (JSON-lines) logger with level filtering. */
export class JsonLogger implements LoggerService {
  constructor(private readonly level: Level | 'silent' = 'info') {}

  private write(level: Level, message: unknown, context?: string, stack?: string) {
    if (ORDER[level] < ORDER[this.level]) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : redact(message),
      ...(stack ? { stack } : {}),
    });
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  }

  log(message: unknown, context?: string) {
    this.write('info', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string) {
    // Nest calls error(message, stack, context); some callers use error(message, context).
    if (context !== undefined) this.write('error', message, context, stackOrContext);
    else this.write('error', message, undefined, stackOrContext);
  }
  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
}
