// xPost.ts — client helpers for the Post-to-X feature.
// Uses credentials:"include" so the session cookie flows (required cross-origin;
// harmless same-origin). In dev, keep VITE_API_BASE empty so requests are
// same-origin via the Vite proxy and cookies "just work".

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const BACKEND_ORIGIN = BASE ? new URL(BASE).origin : window.location.origin;

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
  const res = await fetch(`${BASE}/api/x/status`, { credentials: "include" });
  if (!res.ok) return { connected: false, username: null, configured: false };
  return res.json();
}

export interface XConfigView {
  configured: boolean;
  clientId: string | null;
  callbackUrl: string;
  scopes: string;
  defaultCallback: string;
}

export async function getXConfig(): Promise<XConfigView> {
  const res = await fetch(`${BASE}/api/x/config`, { credentials: "include" });
  return res.json();
}

export interface XConfigInput {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string;
}

export async function saveXConfig(input: XConfigInput): Promise<void> {
  const res = await fetch(`${BASE}/api/x/config`, {
    method: "POST",
    credentials: "include",
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
  await fetch(`${BASE}/api/x/config`, {
    method: "DELETE",
    credentials: "include",
  });
}

// Open the OAuth popup and resolve when the callback messages us back.
export function connectX(): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${BASE}/api/x/login`,
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
      // Verify the message really came from our backend origin.
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
  });
}

export interface PostResult {
  id: string;
  username: string;
  url: string;
}

export async function postToX(text: string): Promise<PostResult> {
  const res = await fetch(`${BASE}/api/x/post`, {
    method: "POST",
    credentials: "include",
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
  await fetch(`${BASE}/api/x/logout`, {
    method: "POST",
    credentials: "include",
  });
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
  const res = await fetch(`${BASE}/api/x/jobs`, { credentials: "include" });
  if (!res.ok)
    return { jobs: [], limits: { minIntervalSec: 300, maxPosts: 100 } };
  return res.json();
}

export async function createJob(input: NewJobInput): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/x/jobs`, {
    method: "POST",
    credentials: "include",
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
  const res = await fetch(`${BASE}/api/x/jobs/${id}`, {
    method: "PATCH",
    credentials: "include",
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
  await fetch(`${BASE}/api/x/jobs/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
}
