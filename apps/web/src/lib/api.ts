export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  token?: string;
  body?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, body, ...init } = options;

  const base =
    typeof window === 'undefined'
      ? (process.env.API_URL ?? 'http://reservo-api-dev:3001/api')
      : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api');

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));

    // On the client side, a 401 means the session is no longer valid.
    // Dispatch an event so SessionWatcher can force signOut.
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new ApiError(err.message ?? err.error ?? `HTTP ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
