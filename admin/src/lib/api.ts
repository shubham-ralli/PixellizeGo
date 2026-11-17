// Base URL is empty in dev (Vite proxies /api) and in prod (served same-origin).
// Set VITE_API_URL for the future static-export + remote-API deployment.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface ApiErrorShape {
  error: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Only send a JSON content-type when there's actually a body — Fastify rejects
  // an empty body when content-type is application/json (e.g. POST /logout).
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body != null) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const err = (body ?? {}) as ApiErrorShape;
    throw new ApiRequestError(res.status, err.error ?? "error", err.message ?? "Request failed");
  }
  return body as T;
}
