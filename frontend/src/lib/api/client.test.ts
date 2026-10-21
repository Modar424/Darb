import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  buildUrl,
  get,
  post,
  setCsrfToken,
  setUnauthorizedHandler,
  apiPage,
} from './client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    setCsrfToken(null);
    setUnauthorizedHandler(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('builds URLs and skips empty query values', () => {
    expect(buildUrl('/courses', { q: 'js', level: '', page: 2, x: undefined, y: null })).toBe(
      '/api/v1/courses?q=js&page=2',
    );
    expect(buildUrl('/auth/me')).toBe('/api/v1/auth/me');
  });

  it('unwraps the data envelope and uses same-origin credentials', async () => {
    const f = vi.fn().mockResolvedValue(json({ data: { ok: 1 } }));
    vi.stubGlobal('fetch', f);
    await expect(get('/x')).resolves.toEqual({ ok: 1 });
    expect(f.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('returns pagination meta for list endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ data: [{ id: 1 }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
        ),
    );
    const page = await apiPage<{ id: number }>('/courses');
    expect(page.items).toHaveLength(1);
    expect(page.meta.total).toBe(1);
  });

  it('sends the CSRF header only on mutating requests', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(json({ data: {} })));
    vi.stubGlobal('fetch', f);
    setCsrfToken('tok123');
    await get('/x');
    await post('/y', { a: 1 });
    expect((f.mock.calls[0]?.[1] as RequestInit).headers).not.toHaveProperty('X-CSRF-Token');
    expect((f.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({
      'X-CSRF-Token': 'tok123',
      'Content-Type': 'application/json',
    });
  });

  it('normalises API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(
            { statusCode: 409, message: 'Already enrolled in this course', requestId: 'r1' },
            409,
          ),
        ),
    );
    const err = await post('/z').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      message: 'Already enrolled in this course',
      requestId: 'r1',
    });
  });

  it('calls the unauthorized handler on 401 unless skipped', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Unauthorized' }, 401)));
    await get('/x').catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    await post('/auth/login', {}, { skipUnauthorizedHandler: true }).catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retries a GET once after a network failure but never a POST', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fail'))
      .mockResolvedValueOnce(json({ data: 1 }));
    vi.stubGlobal('fetch', f);
    await expect(get('/x')).resolves.toBe(1);
    expect(f).toHaveBeenCalledTimes(2);

    const g = vi.fn().mockRejectedValue(new TypeError('fail'));
    vi.stubGlobal('fetch', g);
    const err = await post('/x').catch((e: unknown) => e);
    expect(g).toHaveBeenCalledTimes(1);
    expect(err).toMatchObject({ status: 0 });
    expect((err as ApiError).isNetwork).toBe(true);
  });

  it('handles non-JSON error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
        ),
    );
    await expect(get('/x')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });
});

describe('session probe', () => {
  it('a 401 from /auth/me does not trigger the session-expired handler', async () => {
    const { authApi } = await import('./endpoints');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ message: 'Authentication required' }, 401)),
    );
    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
