export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  publicUrl: string;
  isProduction: boolean;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    ssl: boolean;
  };
  corsOrigins: string[];
  cookie: { secure: boolean; domain?: string; name: string; csrfName: string };
  session: { ttlMinutes: number; absoluteTtlHours: number };
  passwordResetTtlMinutes: number;
  login: { maxFailures: number; lockMinutes: number };
  throttle: { ttlSeconds: number; limit: number; authLimit: number };
  argon2: { memoryKib: number; timeCost: number };
  bodyLimit: string;
  trustProxy: boolean;
  swaggerEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  mailTransport: 'console' | 'none';
}

type Env = Record<string, string | undefined>;

function str(env: Env, key: string, fallback?: string): string {
  const v = env[key];
  if (v === undefined || v === '') {
    if (fallback === undefined) throw new Error(`Missing required environment variable: ${key}`);
    return fallback;
  }
  return v;
}

function int(env: Env, key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Environment variable ${key} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function bool(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (['true', '1', 'yes'].includes(raw.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(raw.toLowerCase())) return false;
  throw new Error(`Environment variable ${key} must be a boolean`);
}

export function loadConfig(env: Env = process.env): AppConfig {
  const nodeEnv = str(env, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const isProduction = nodeEnv === 'production';

  const corsOrigins = str(env, 'CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigins.some((o) => o === '*' || !/^https?:\/\/[^/\s]+$/.test(o))) {
    throw new Error(
      'CORS_ORIGINS must be explicit origins (scheme://host[:port]); wildcards are not allowed',
    );
  }

  const cookieSecure = bool(env, 'COOKIE_SECURE', isProduction);
  const mailTransport = str(env, 'MAIL_TRANSPORT', isProduction ? 'none' : 'console');
  if (!['console', 'none'].includes(mailTransport))
    throw new Error('MAIL_TRANSPORT must be console or none');

  if (isProduction) {
    if (!cookieSecure) throw new Error('COOKIE_SECURE must be true in production');
    if (mailTransport === 'console')
      throw new Error('MAIL_TRANSPORT=console is not allowed in production');
    if (corsOrigins.some((o) => o.startsWith('http://'))) {
      throw new Error('CORS_ORIGINS must use https in production');
    }
  }

  const logLevel = str(env, 'LOG_LEVEL', nodeEnv === 'test' ? 'silent' : 'info');
  if (!['debug', 'info', 'warn', 'error', 'silent'].includes(logLevel)) {
    throw new Error('LOG_LEVEL must be debug, info, warn, error or silent');
  }

  return {
    env: nodeEnv as AppConfig['env'],
    port: int(env, 'PORT', 3001, 1, 65535),
    publicUrl: str(env, 'APP_PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, ''),
    isProduction,
    db: {
      host: str(env, 'DB_HOST', '127.0.0.1'),
      port: int(env, 'DB_PORT', 3306, 1, 65535),
      user: str(env, 'DB_USER'),
      password: str(env, 'DB_PASSWORD'),
      name: str(env, 'DB_NAME'),
      ssl: bool(env, 'DB_SSL', false),
    },
    corsOrigins,
    cookie: {
      secure: cookieSecure,
      domain: env.COOKIE_DOMAIN || undefined,
      name: cookieSecure && !env.COOKIE_DOMAIN ? '__Host-lms_sid' : 'lms_sid',
      csrfName: 'lms_csrf',
    },
    session: {
      ttlMinutes: int(env, 'SESSION_TTL_MINUTES', 720, 5, 60 * 24 * 30),
      absoluteTtlHours: int(env, 'SESSION_ABSOLUTE_TTL_HOURS', 168, 1, 24 * 90),
    },
    passwordResetTtlMinutes: int(env, 'PASSWORD_RESET_TTL_MINUTES', 30, 5, 24 * 60),
    login: {
      maxFailures: int(env, 'LOGIN_MAX_FAILURES', 5, 1, 100),
      lockMinutes: int(env, 'LOGIN_LOCK_MINUTES', 15, 1, 24 * 60),
    },
    throttle: {
      ttlSeconds: int(env, 'THROTTLE_TTL_SECONDS', 60, 1, 3600),
      limit: int(env, 'THROTTLE_LIMIT', 120, 1, 100000),
      authLimit: int(env, 'AUTH_THROTTLE_LIMIT', 10, 1, 100000),
    },
    argon2: {
      memoryKib: int(env, 'ARGON2_MEMORY_KIB', 19456, 1024, 1048576),
      timeCost: int(env, 'ARGON2_TIME_COST', 2, 1, 20),
    },
    bodyLimit: str(env, 'BODY_LIMIT', '256kb'),
    trustProxy: bool(env, 'TRUST_PROXY', false),
    swaggerEnabled: bool(env, 'SWAGGER_ENABLED', !isProduction),
    logLevel: logLevel as AppConfig['logLevel'],
    mailTransport: mailTransport as AppConfig['mailTransport'],
  };
}

export const APP_CONFIG = 'APP_CONFIG';
