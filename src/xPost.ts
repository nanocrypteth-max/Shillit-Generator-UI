// xPost.ts — client helpers for the Post-to-X feature.
// Sends the Privy access token (Authorization: Bearer …) so the backend can key
// the user's X credentials + tokens by their wallet/login identity. Falls back to
// the cookie session when no token is available. Uses credentials:"include" so the
// session cookie flows (needed for the OAuth popup), same-origin via the Vercel proxy.

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const BACKEND_ORIGIN = BASE ? new URL(BASE).origin : window.location.origin;

// The Privy token getter is injected by the gate (see gate.tsx). Default: none.
let tokenProvider: () => Promise<string | null> = async () => null;
export function setPrivyTokenProvider(fn: () => Promise<string | null>): void {
  tokenProvider = fn;
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let token: string | null = null;
  try {
    token = await tokenProvider();
  } catch {
    token = null;
  }
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE}${path}`, { ...init, credentials: "include", headers });
}

export class XPostError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface XStatus {
  connected: boolean;
  username: string | null;
  configured: boolean;
}

export async function getXStatus(): Promise<XStatus> {
  const res = await authedFetch("/api/x/status");
  if (!res.ok) return { connected: false, username: null, configured: false };
  return res.json();
}

export interface XConfigView {
  configured: boolean;
  clientId: string | null;
  callbackUrl: string;
  scopes: string;
  defaultCallback: string;
  secretLast3: string | null;
}

export async function getXConfig(): Promise<XConfigView> {
  const res = await authedFetch("/api/x/config");
  return res.json();
}

export interface XConfigInput {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string;
}

export async function saveXConfig(input: XConfigInput): Promise<void> {
  const res = await authedFetch("/api/x/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new XPostError(
      data.error ?? "error",
      data.message ?? "Save failed",
      res.status,
    );
}

export async function clearXConfig(): Promise<void> {
  await authedFetch("/api/x/config", { method: "DELETE" });
}

// Open the OAuth popup and resolve when the callback messages us back.
export function connectX(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Open synchronously (within the click gesture) to avoid popup blockers,
    // then bind this cookie session to the verified owner before navigating to login.
    const popup = window.open(
      "about:blank",
      "x_oauth",
      "width=600,height=760,menubar=no,toolbar=no",
    );
    if (!popup)
      return reject(
        new XPostError(
          "popup_blocked",
          "Popup blocked — allow popups and retry.",
          0,
        ),
      );

    let settled = false;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== BACKEND_ORIGIN) return;
      if (!e.data || e.data.source !== "shill-x") return;
      settled = true;
      cleanup();
      e.data.ok
        ? resolve()
        : reject(
            new XPostError(
              "auth_failed",
              e.data.error || "Authorization failed",
              0,
            ),
          );
    };
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(
          new XPostError("popup_closed", "Window closed before finishing.", 0),
        );
      }
    }, 500);
    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    }
    window.addEventListener("message", onMessage);

    // Bind cookie session -> verified owner (Privy id), THEN navigate to /api/x/login.
    authedFetch("/api/x/flow-init", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        if (!popup.closed) popup.location.href = `${BASE}/api/x/login`;
      });
  });
}

export interface PostResult {
  id: string;
  username: string;
  url: string;
}

export async function postToX(text: string): Promise<PostResult> {
  const res = await authedFetch("/api/x/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new XPostError(
      data.error ?? "error",
      data.message ?? "Post failed",
      res.status,
    );
  return data as PostResult;
}

export async function logoutX(): Promise<void> {
  await authedFetch("/api/x/logout", { method: "POST" });
}

// ---- Mode 2: scheduled jobs ----
export interface Job {
  id: string;
  ca: string;
  chain: string | null;
  tone: string;
  language: string;
  withHashtags: boolean;
  intervalSec: number;
  remaining: number;
  total: number;
  status: "active" | "paused" | "done";
  nextRun: string;
  lastPostUrl: string | null;
  lastError: string | null;
}

export interface JobsView {
  jobs: Job[];
  limits: { minIntervalSec: number; maxPosts: number };
}

export interface NewJobInput {
  ca: string;
  chain?: string;
  tone: string;
  language: string;
  withHashtags: boolean;
  intervalSec: number;
  total: number;
}

export async function listJobs(): Promise<JobsView> {
  const res = await authedFetch("/api/x/jobs");
  if (!res.ok)
    return { jobs: [], limits: { minIntervalSec: 300, maxPosts: 100 } };
  return res.json();
}

export async function createJob(input: NewJobInput): Promise<{ id: string }> {
  const res = await authedFetch("/api/x/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new XPostError(
      data.error ?? "error",
      data.message ?? "Create failed",
      res.status,
    );
  return data;
}

export async function patchJob(
  id: string,
  status: "active" | "paused",
): Promise<void> {
  const res = await authedFetch(`/api/x/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new XPostError(
      d.error ?? "error",
      d.message ?? "Update failed",
      res.status,
    );
  }
}

export async function deleteJob(id: string): Promise<void> {
  await authedFetch(`/api/x/jobs/${id}`, { method: "DELETE" });
}
