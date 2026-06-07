import { useEffect, useState } from "react";
import {
  connectX,
  getXConfig,
  getXStatus,
  logoutX,
  postToX,
  XPostError,
  type PostResult,
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
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [state, setState] = useState<State>({ k: "idle" });

  async function refresh() {
    const s = await getXStatus();
    setConnected(s.connected);
    setConfigured(s.configured);
    setUsername(s.username);
    if (s.configured) {
      const c = await getXConfig();
      setClientId(c.clientId);
    } else {
      setClientId(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => setState({ k: "idle" }), [text]);

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
    // No X credentials yet -> guide the user to the Profile tab to add them.
    if (!configured) {
      setState({ k: "error", msg: "Fill the key to your X first" });
      onConfigure?.();
      return;
    }
    await runPost();
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
        {connected && username ? (
          <>
            <span>connected as @{username}</span>
            <button className="x-link" onClick={disconnect}>
              disconnect
            </button>
          </>
        ) : configured ? (
          <span className="x-dim">ready — click to connect &amp; post</span>
        ) : (
          <span className="x-dim">no X app set — add it in Profile</span>
        )}
      </div>

      {/* When credentials exist, show only the Client ID (dApp style). */}
      {configured && clientId && (
        <div className="xid-chip">
          <span className="xid-label">X CLIENT ID</span>
          <span className="xid-value">{clientId}</span>
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
