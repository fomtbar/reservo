const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4001/api';

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = `Error ${res.status}`;
    try { message = JSON.parse(body).message ?? message; } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
