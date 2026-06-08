import { useEffect, useState } from "react";
import { useGenerateAccess } from "./gate";
import { getXConfig, saveXConfig, XPostError, type XConfigView } from "./xPost";
import { ENABLE_CRED_EDIT } from "./gateConfig";

function avatarGradient(address: string | null): string {
  if (!address) return "linear-gradient(135deg, #b6ff3c, #6f9e22)";
  // Char-hash so it works for both 0x (EVM) and base58 (Solana) addresses.
  let h = 0;
  for (let i = 0; i < address.length; i++)
    h = (h * 31 + address.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 75% 55%), hsl(${(h + 50) % 360} 75% 45%))`;
}

export default function Profile() {
  const gate = useGenerateAccess();

  const [cfg, setCfg] = useState<XConfigView | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const c = await getXConfig();
    setCfg(c);
    setClientId(c.clientId ?? "");
  }
  useEffect(() => {
    load();
  }, [gate.authenticated]);

  function copyAddr() {
    if (!gate.address) return;
    navigator.clipboard.writeText(gate.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function save() {
    setMsg(null);
    if (!clientId.trim() || !clientSecret.trim()) {
      setMsg({
        ok: false,
        text: "Both Client ID and Client Secret are required.",
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
      setClientSecret("");
      await load();
      setMsg({ ok: true, text: "Saved. Your X app credentials are stored." });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof XPostError ? e.message : (e as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  const configured = !!cfg?.configured;

  return (
    <div className="profile-tab">
      {/* Wallet */}
      <div className="panel">
        <div className="sched-title">Wallet</div>
        {gate.enabled ? (
          gate.authenticated ? (
            <div className="pf-wallet">
              <span
                className="pf-avatar"
                style={{ background: avatarGradient(gate.address) }}
              />
              <div className="pf-wallet-info">
                <div className="pf-row">
                  <span className="pf-label">Status</span>
                  <span className="pf-val acc">● Connected</span>
                </div>
                <div className="pf-row">
                  <span className="pf-label">Name</span>
                  <span className="pf-val">
                    {gate.address
                      ? `${gate.address.slice(0, 6)}…${gate.address.slice(-4)}`
                      : "Wallet"}
                  </span>
                </div>
                <div className="pf-row">
                  <span className="pf-label">CA / Address</span>
                  <span className="pf-val mono break">
                    {gate.address ?? "—"}
                  </span>
                </div>
                <div className="pf-actions">
                  <button
                    className="ca-copy"
                    onClick={copyAddr}
                    disabled={!gate.address}
                  >
                    {copied ? "Copied ✓" : "Copy address"}
                  </button>
                  <button className="x-link" onClick={gate.logout}>
                    disconnect
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pf-connect">
              <span className="x-dim">
                Connect your wallet to see your profile.
              </span>
              <button className="x-save" onClick={gate.login}>
                Connect Wallet
              </button>
            </div>
          )
        ) : (
          <span className="x-dim">Wallet login is not enabled.</span>
        )}
      </div>

      {/* X credentials */}
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="sched-title">X Developer App</div>

        {gate.enabled && !gate.authenticated ? (
          <span className="x-dim">
            Connect your wallet first to manage your X app credentials.
          </span>
        ) : !configured ? (
          <span className="x-dim">
            No X app set yet — add your Client ID &amp; Secret from the “Post
            Now to X” panel under the Manual tab.
          </span>
        ) : (
          <>
            {/* Read-only view of the stored credentials. */}
            <div className="ca-bar" style={{ marginBottom: 12 }}>
              <span className="ca-label">CLIENT ID</span>
              <span className="ca-value">{cfg?.clientId}</span>
            </div>
            <div className="ca-bar" style={{ marginBottom: 16 }}>
              <span className="ca-label">CLIENT SECRET</span>
              <span className="ca-value">
                {"•".repeat(12) + (cfg?.secretLast3 ?? "")}
              </span>
              <span className="pf-stored">encrypted ✓</span>
            </div>

            {ENABLE_CRED_EDIT ? (
              <>
                <p className="x-form-note">
                  Update your X app credentials. Register this Callback in your
                  X app: <code>{cfg?.defaultCallback ?? "…"}</code>
                </p>
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
                  placeholder="Re-enter secret to update"
                  type="password"
                  autoComplete="off"
                />
                <div className="x-form-actions">
                  <button
                    className="x-save"
                    onClick={save}
                    disabled={
                      saving || !clientId.trim() || !clientSecret.trim()
                    }
                  >
                    {saving ? "Saving…" : "Update credentials"}
                  </button>
                </div>
                {msg && (
                  <div
                    className={msg.ok ? "x-ok" : "x-err"}
                    style={{ marginTop: 12 }}
                  >
                    {msg.ok ? "✓ " : "✕ "}
                    {msg.text}
                  </div>
                )}
              </>
            ) : (
              <span className="x-dim">
                Editing credentials is currently disabled.
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
