import { loadConfig } from './configuration';

const base = { DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'n' };

describe('loadConfig', () => {
  it('applies safe development defaults', () => {
    const c = loadConfig({ ...base });
    expect(c).toMatchObject({ env: 'development', port: 3001, isProduction: false });
    expect(c.cookie.secure).toBe(false);
    expect(c.corsOrigins).toEqual(['http://localhost:3000']);
  });
  it('fails fast when required variables are missing', () => {
    expect(() => loadConfig({ DB_USER: 'u' })).toThrow(/DB_PASSWORD/);
  });
  it('rejects wildcard or malformed CORS origins', () => {
    expect(() => loadConfig({ ...base, CORS_ORIGINS: '*' })).toThrow(/wildcard/);
    expect(() => loadConfig({ ...base, CORS_ORIGINS: 'localhost:3000' })).toThrow();
  });
  it('enforces production hardening', () => {
    const prod = { ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.test' };
    const c = loadConfig(prod);
    expect(c.cookie.secure).toBe(true);
    expect(c.cookie.name).toBe('__Host-lms_sid');
    expect(c.swaggerEnabled).toBe(false);
    expect(c.mailTransport).toBe('none');
    expect(() => loadConfig({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...prod, MAIL_TRANSPORT: 'console' })).toThrow(/console/);
    expect(() => loadConfig({ ...prod, CORS_ORIGINS: 'http://app.example.test' })).toThrow(/https/);
  });
  it('validates numeric ranges', () => {
    expect(() => loadConfig({ ...base, PORT: '99999' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, LOGIN_MAX_FAILURES: 'abc' })).toThrow();
  });
});
