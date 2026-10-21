import type { Page, PageMeta } from './types';

export const API_BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 20_000;

/** Normalised API failure. `status === 0` means the network (or a timeout) failed. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
interface RequestOptions {
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Do not treat a 401 as "session expired" (used by login/register/etc.). */
  skipUnauthorizedHandler?: boolean;
}

// --- session plumbing kept in memory only (never in localStorage) ---------------------------
let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
export const setCsrfToken = (t: string | null): void => {
  csrfToken = t;
};
export const getCsrfToken = (): string | null => csrfToken;
export const setUnauthorizedHandler = (fn: (() => void) | null): void => {
  unauthorizedHandler = fn;
};

export function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ''}`;
}

interface ErrorBody {
  message?: unknown;
  details?: unknown;
  requestId?: unknown;
}
async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    /* non-JSON error body */
  }
  const message = typeof body.message === 'string' ? body.message : res.statusText || 'Error';
  return new ApiError(
    res.status,
    message,
    body.details,
    typeof body.requestId === 'string' ? body.requestId : undefined,
  );
}

function withTimeout(external?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException('Timeout', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );
  const onAbort = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) onAbort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

async function raw(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  const isRead = method === 'GET';
  const attempts = isRead ? 2 : 1; // safe retry for idempotent reads only
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const t = withTimeout(opts.signal);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      if (!isRead && csrfToken) headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch(buildUrl(path, opts.query), {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: t.signal,
      });
      return res;
    } catch (err) {
      if (opts.signal?.aborted) throw err; // caller cancelled: propagate as-is
      lastError = err;
    } finally {
      t.done();
    }
  }
  throw new ApiError(0, lastError instanceof Error ? lastError.message : 'Network error');
}

async function send(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  const res = await raw(method, path, opts);
  if (res.ok) return res;
  const err = await toApiError(res);
  if (err.status === 401 && !opts.skipUnauthorizedHandler) unauthorizedHandler?.();
  throw err;
}

export async function api<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, opts);
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function apiPage<T>(path: string, opts: RequestOptions = {}): Promise<Page<T>> {
  const res = await send('GET', path, opts);
  const json = (await res.json()) as { data: T[]; meta: PageMeta };
  return { items: json.data, meta: json.meta };
}

export const get = <T>(path: string, query?: Query, signal?: AbortSignal) =>
  api<T>('GET', path, { query, signal });
export const post = <T>(path: string, body?: unknown, o: RequestOptions = {}) =>
  api<T>('POST', path, { ...o, body });
export const patch = <T>(path: string, body?: unknown) => api<T>('PATCH', path, { body });
export const put = <T>(path: string, body?: unknown) => api<T>('PUT', path, { body });
export const del = <T>(path: string) => api<T>('DELETE', path);
