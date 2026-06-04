import { useEffect, useState } from "react";
import {
  connectX,
  getXConfig,
  getXStatus,
  logoutX,
  postToX,
  saveXConfig,
  XPostError,
  type PostResult,
  type XConfigView,
} from "./xPost";

type State =
  | { k: "idle" }
  | { k: "working"; msg: string }
  | { k: "done"; result: PostResult }
  | { k: "error"; msg: string };

export default function PostToX({ text }: { text: string }) {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [state, setState] = useState<State>({ k: "idle" });

  // credentials form
  const [showForm, setShowForm] = useState(false);
  const [cfg, setCfg] = useState<XConfigView | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [scopes, setScopes] = useState("");
  const [savingCfg, setSavingCfg] = useState(false);

  async function refresh() {
    const s = await getXStatus();
    setConnected(s.connected);
    setConfigured(s.configured);
    setUsername(s.username);
  }

  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => setState({ k: "idle" }), [text]);

  async function openForm() {
    const c = await getXConfig();
    setCfg(c);
    setClientId(c.clientId ?? "");
    setClientSecret(""); // never prefilled
    setCallbackUrl(c.callbackUrl);
    setScopes(c.scopes);
    setShowForm(true);
  }

  async function submitConfig() {
    setSavingCfg(true);
    setState({ k: "idle" });
    try {
      await saveXConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        callbackUrl: callbackUrl.trim(),
        scopes: scopes.trim(),
      });
      setShowForm(false);
      setConfigured(true);
      // proceed straight into connect + post
      await runPost(true);
    } catch (e) {
      setState({
        k: "error",
        msg: e instanceof XPostError ? e.message : (e as Error).message,
      });
    } finally {
      setSavingCfg(false);
    }
  }

  async function runPost(skipConfigCheck = false) {
    try {
      if (!connected) {
        setState({ k: "working", msg: "Connecting to X…" });
        await connectX();
        await refresh();
        const s = await getXStatus();
        if (!s.connected)
          throw new XPostError(
            "not_connected",
            "Connection did not complete.",
            0,
          );
      }
      setState({ k: "working", msg: "Posting…" });
      const result = await postToX(text);
      setState({ k: "done", result });
    } catch (e) {
      const msg = e instanceof XPostError ? e.message : (e as Error).message;
      if (e instanceof XPostError) {
        if (e.status === 401 || e.code === "reauth_required") {
          setConnected(false);
          setUsername(null);
        }
        if (e.code === "x_not_configured" && !skipConfigCheck) {
          setConfigured(false);
          openForm();
          return;
        }
      }
      setState({ k: "error", msg });
    }
  }

  async function onClick() {
    // No credentials yet -> collect them first.
    if (!configured) {
      await openForm();
      return;
    }
    await runPost();
  }

  async function disconnect() {
    await logoutX();
    await refresh();
    setState({ k: "idle" });
  }

  const busy = state.k === "working" || savingCfg;

  return (
    <div className="x-block">
      <button className="x-btn" onClick={onClick} disabled={busy || !text}>
        <span className="x-glyph">𝕏</span>
        {busy
          ? state.k === "working"
            ? state.msg
            : "Saving…"
          : "Post Now to X"}
      </button>

      <div className="x-meta">
        {connected && username ? (
          <>
            <span>connected as @{username}</span>
            <button className="x-link" onClick={disconnect}>
              disconnect
            </button>
          </>
        ) : configured ? (
          <>
            <span className="x-dim">
              credentials saved — click to connect &amp; post
            </span>
            <button className="x-link" onClick={openForm}>
              edit keys
            </button>
          </>
        ) : (
          <span className="x-dim">
            bring your own X developer app — click to enter keys
          </span>
        )}
      </div>

      {showForm && (
        <div className="x-form">
          <div className="x-form-title">Your X App Credentials</div>
          <p className="x-form-note">
            From your X developer app (OAuth 2.0, Confidential client, Read and
            write). Register this exact Callback URL in your X app:{" "}
            <code>{cfg?.defaultCallback}</code>
          </p>

          <label>Client ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="OAuth 2.0 Client ID"
            autoComplete="off"
          />

          <label>Client Secret</label>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="OAuth 2.0 Client Secret"
            type="password"
            autoComplete="off"
          />

          <label>Callback URL</label>
          <input
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            autoComplete="off"
          />

          <label>Scopes</label>
          <input
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            autoComplete="off"
          />

          <div className="x-form-actions">
            <button
              className="x-save"
              onClick={submitConfig}
              disabled={savingCfg || !clientId.trim() || !clientSecret.trim()}
            >
              {savingCfg ? "Saving…" : "Save & Connect"}
            </button>
            <button className="x-link" onClick={() => setShowForm(false)}>
              cancel
            </button>
          </div>
        </div>
      )}

      {state.k === "done" && (
        <div className="x-ok">
          ✓ Posted —{" "}
          <a href={state.result.url} target="_blank" rel="noopener noreferrer">
            view tweet ↗
          </a>
        </div>
      )}
      {state.k === "error" && <div className="x-err">✕ {state.msg}</div>}
    </div>
  );
}
