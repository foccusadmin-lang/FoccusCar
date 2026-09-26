export class GatewayHttpError extends Error {
  constructor(readonly provider: string, readonly status: number, readonly body: unknown) {
    super(`Falha na comunicação com ${provider} (HTTP ${status}).`);
  }
}

export async function requestJson<T>(provider: string, url: string, init: RequestInit & { fetchImpl?: typeof fetch }): Promise<T> {
  const res = await (init.fetchImpl ?? fetch)(url, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new GatewayHttpError(provider, res.status, body);
  return body as T;
}
