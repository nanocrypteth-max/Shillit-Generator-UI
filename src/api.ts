// api.ts
// SINGLE place to point the UI at your backend.
// - VITE_API_BASE empty  -> calls "/api/generate" (same-origin; dev proxy handles it)
// - VITE_API_BASE set     -> calls "<base>/api/generate" (enable CORS on backend)

import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ChartResponse,
  RiskReport,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiException extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function generate(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    // Network / CORS / timeout failures land here (no HTTP status).
    throw new ApiException(
      "network",
      (e as Error).message || "Network error",
      0,
    );
  }

  const data = (await res.json().catch(() => ({}))) as Partial<
    GenerateResponse & ApiError
  >;

  if (!res.ok) {
    throw new ApiException(
      data.error ?? "error",
      data.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as GenerateResponse;
}

export async function fetchChart(
  network: string,
  pool: string,
  tf: "minute" | "hour" | "day" = "hour",
): Promise<ChartResponse> {
  const qs = new URLSearchParams({ network, pool, tf });
  const res = await fetch(`${BASE}/api/chart?${qs}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<
    ChartResponse & ApiError
  >;
  if (!res.ok)
    throw new ApiException(
      data.error ?? "error",
      data.message ?? "chart failed",
      res.status,
    );
  return { points: data.points ?? [] };
}

export async function getSecurity(
  ca: string,
  chain: string,
): Promise<RiskReport> {
  const qs = new URLSearchParams({ ca, chain });
  const res = await fetch(`${BASE}/api/security?${qs}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<
    RiskReport & ApiError
  >;
  if (!res.ok)
    throw new ApiException(
      data.error ?? "error",
      data.message ?? "security failed",
      res.status,
    );
  return data as RiskReport;
}
