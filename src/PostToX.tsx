import { useEffect, useState } from "react";
import { useGenerateAccess } from "./gate";
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

export default function PostToX({
  text,
  onConfigure,
}: {
  text: string;
  onConfigure?: () => void;
}) {
  const gate = useGenerateAccess();
  const needWallet = gate.enabled && !gate.authenticated;

  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [cfg, setCfg] = useState<XConfigView | null>(null);
  const [state, setState] = useState<State>({ k: "idle" });

  // inline first-time setup form (only shown when no credentials exist yet)
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [s, c] = await Promise.all([getXStatus(), getXConfig()]);
    setConnected(s.connected);
    setUsername(s.username);
    setCfg(c);
  }

  // Re-check on mount and whenever wallet auth flips (disconnect changes the owner).
  useEffect(() => {
    refresh();
  }, [gate.authenticated]);
  useEffect(() => setState({ k: "idle" }), [text]);

  const configured = !!cfg?.configured;

  async function runPost() {
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
      if (
        e instanceof XPostError &&
        (e.status === 401 || e.code === "reauth_required")
      ) {
        setConnected(false);
        setUsername(null);
      }
      setState({ k: "error", msg });
    }
  }

  async function onClick() {
    // Wallet disconnected -> send the user to wallet login first.
    if (needWallet) {
      setState({ k: "error", msg: "Connect your wallet first" });
      gate.login();
      return;
    }
    // No credentials yet -> show the message; the inline setup form is right below.
    if (!configured) {
      setState({ k: "error", msg: "Fill the key to your X first" });
      return;
    }
    await runPost();
  }

  async function saveInline() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setState({
        k: "error",
        msg: "Both Client ID and Client Secret are required.",
      });
      return;
    }
    setSaving(true);
    try {
      await saveXConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        callbackUrl: cfg?.callbackUrl ?? "",
        scopes: cfg?.scopes ?? "",
      });
      setClientId("");
      setClientSecret("");
      await refresh();
      setState({ k: "idle" });
    } catch (e) {
      setState({
        k: "error",
        msg: e instanceof XPostError ? e.message : (e as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    await logoutX();
    await refresh();
    setState({ k: "idle" });
  }

  const busy = state.k === "working";

  return (
    <div className="x-block">
      <button className="x-btn" onClick={onClick} disabled={busy || !text}>
        <span className="x-glyph">𝕏</span>
        {busy ? state.msg : "Post Now to X"}
      </button>

      <div className="x-meta">
        {needWallet ? (
          <span className="x-dim">connect your wallet to post</span>
        ) : connected && username ? (
          <>
            <span>connected as @{username}</span>
            <button className="x-link" onClick={disconnect}>
              disconnect
            </button>
          </>
        ) : configured ? (
          <span className="x-dim">ready — click to connect &amp; post</span>
        ) : (
          <span className="x-dim">no X app set yet</span>
        )}
      </div>

      {/* Configured: show only the Client ID (dApp chip) + point edits to Profile. */}
      {!needWallet && configured && cfg?.clientId && (
        <div className="xid-chip">
          <span className="xid-label">X CLIENT ID</span>
          <span className="xid-value">{cfg.clientId}</span>
          {onConfigure && (
            <button
              className="x-link xid-edit"
              onClick={onConfigure}
              title="Edit in Profile"
            >
              edit
            </button>
          )}
        </div>
      )}

      {/* Not configured: inline first-time setup (Option C). */}
      {!needWallet && !configured && (
        <div className="x-inline-form">
          <label>Client ID</label>
          <input
            className="pf-input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="OAuth 2.0 Client ID"
            autoComplete="off"
            spellCheck={false}
          />
          <label>Client Secret</label>
          <input
            className="pf-input"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="OAuth 2.0 Client Secret"
            type="password"
            autoComplete="off"
          />
          <p className="x-form-note">
            Register this Callback in your X app:{" "}
            <code>{cfg?.defaultCallback ?? "…"}</code>
          </p>
          <button
            className="x-save"
            onClick={saveInline}
            disabled={saving || !clientId.trim() || !clientSecret.trim()}
          >
            {saving ? "Saving…" : "Save credentials"}
          </button>
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
