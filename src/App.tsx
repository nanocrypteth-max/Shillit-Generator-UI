import { useState, useEffect } from "react";
import { generate, getSecurity, ApiException } from "./api";
import PriceChart from "./PriceChart";
import PostToX from "./PostToX";
import Scheduler from "./Scheduler";
import Profile from "./Profile";
import { useGenerateAccess } from "./gate";
import {
  SHILLIT_CA,
  MODES,
  ENABLE_PROFILE,
  ENABLE_SCHEDULER,
  X_URL,
  FARCASTER_URL,
} from "./gateConfig";
import type {
  GenerateResponse,
  Tone,
  Lang,
  TokenMarket,
  RiskReport,
} from "./types";

const CHAINS = [
  { value: "", label: "Auto" },
  { value: "eth", label: "Ethereum" },
  { value: "bsc", label: "BSC" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "polygon", label: "Polygon" },
  { value: "solana", label: "Solana" },
];

// Mode list now comes from config (gateConfig.MODES) — see VITE_MODES.

function usd(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n <= 0) return "n/a";
  if (n >= 1) return "$" + Math.round(n).toLocaleString("en-US");
  return "$" + Number(n).toPrecision(4);
}

// Deterministic gradient avatar from a wallet address.
function avatarGradient(address: string | null): string {
  if (!address) return "linear-gradient(135deg, #b6ff3c, #6f9e22)";
  const h = parseInt(address.slice(2, 8) || "0", 16) % 360;
  return `linear-gradient(135deg, hsl(${h} 75% 55%), hsl(${(h + 50) % 360} 75% 45%))`;
}

function ageStr(epochMs: number): string {
  if (!epochMs) return "n/a";
  const h = (Date.now() - epochMs) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m old`;
  if (h < 24) return `${Math.round(h)}h old`;
  return `${Math.round(h / 24)}d old`;
}

// Render the token info table to a PNG blob (dApp card, matches the on-screen panel).
async function renderTokenCardBlob(m: TokenMarket, chg: number): Promise<Blob> {
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* fonts optional */
  }
  const scale = 2;
  const W = 900,
    H = 360,
    P = 28;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const C = {
    bg: "#0a0e10",
    border: "rgba(182,255,60,0.25)",
    cell: "#0e1417",
    line: "rgba(255,255,255,0.06)",
    accent: "#b6ff3c",
    text: "#e6ebe8",
    dim: "#7c8a82",
    red: "#ff5470",
  };
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const DISP = "'Chakra Petch', " + MONO;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  ctx.fillStyle = C.bg;
  rr(0, 0, W, H, 18);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.border;
  rr(0.5, 0.5, W - 1, H - 1, 18);
  ctx.stroke();

  // header
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 30px " + DISP;
  ctx.fillStyle = C.accent;
  const sym = "$" + m.symbol;
  ctx.fillText(sym, P, 52);
  const symW = ctx.measureText(sym).width;
  ctx.font = "500 17px " + MONO;
  ctx.fillStyle = C.dim;
  ctx.fillText(m.name, P + symW + 14, 50);

  const tag = `${m.source.toUpperCase()} · ${m.chain.toUpperCase()}`;
  ctx.font = "600 12px " + MONO;
  const tagW = ctx.measureText(tag).width;
  const pillW = tagW + 24;
  const pillX = W - P - pillW;
  ctx.strokeStyle = C.line;
  rr(pillX, 32, pillW, 28, 6);
  ctx.stroke();
  ctx.fillStyle = C.dim;
  ctx.fillText(tag, pillX + 12, 50);

  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(P, 76);
  ctx.lineTo(W - P, 76);
  ctx.stroke();

  // grid
  const gap = 12;
  const gridX = P,
    gridY = 92,
    rowH = 72;
  const colW = (W - 2 * P - 2 * gap) / 3;
  const cell = (
    col: number,
    row: number,
    label: string,
    value: string,
    color?: string,
    full?: boolean,
  ) => {
    const cw = full ? W - 2 * P : colW;
    const cx = gridX + col * (colW + gap);
    const cy = gridY + row * (rowH + gap);
    ctx.fillStyle = C.cell;
    rr(cx, cy, cw, rowH, 10);
    ctx.fill();
    ctx.font = "500 11px " + MONO;
    ctx.fillStyle = C.dim;
    ctx.fillText(label.toUpperCase(), cx + 16, cy + 27);
    ctx.font = "600 20px " + MONO;
    ctx.fillStyle = color ?? C.text;
    ctx.fillText(value, cx + 16, cy + 53);
  };
  cell(0, 0, "Price", usd(m.priceUsd));
  cell(
    1,
    0,
    m.marketCap == null ? "FDV" : "MCap / FDV",
    usd(m.marketCap ?? m.fdv),
  );
  cell(2, 0, "24h Vol", usd(m.volume24h));
  cell(0, 1, "Liquidity", usd(m.liquidityUsd));
  cell(
    1,
    1,
    "24h Change",
    (chg > 0 ? "+" : "") + chg.toFixed(1) + "%",
    chg >= 0 ? C.accent : C.red,
  );
  cell(2, 1, "24h Txns", `${m.txns24h.buys} / ${m.txns24h.sells}`);
  cell(0, 2, "Age", ageStr(m.pairCreatedAt), undefined, true);

  ctx.font = "700 12px " + DISP;
  ctx.fillStyle = "rgba(182,255,60,0.5)";
  ctx.textAlign = "right";
  ctx.fillText("SHILLIT.AI", W - P, H - 14);
  ctx.textAlign = "left";

  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("blob failed"))),
      "image/png",
    ),
  );
}

export default function App() {
  const [mode, setMode] = useState<"profile" | "manual" | "scheduler">(
    "manual",
  );
  const [ca, setCa] = useState("");
  const [chain, setChain] = useState("");
  const [tone, setTone] = useState<string>(MODES[0]?.value ?? "hype");
  const [lang, setLang] = useState<Lang>("en");
  const [withHashtags, setWithHashtags] = useState(false);
  const [replyTo, setReplyTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [risk, setRisk] = useState<RiskReport | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedCa, setCopiedCa] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const gate = useGenerateAccess();

  function copyShillitCa() {
    if (!SHILLIT_CA) return;
    navigator.clipboard.writeText(SHILLIT_CA);
    setCopiedCa(true);
    setTimeout(() => setCopiedCa(false), 1400);
  }

  // UX: once the wallet connects, drop the "connect your wallet" alert.
  useEffect(() => {
    if (gate.authenticated) {
      setError((e) =>
        e && e.toLowerCase().includes("connect your wallet") ? null : e,
      );
    }
  }, [gate.authenticated]);

  function copyAddress() {
    if (!gate.address) return;
    navigator.clipboard.writeText(gate.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1400);
  }

  async function onGenerate() {
    setError(null);
    setResult(null);
    if (!ca.trim()) {
      setError("Enter a contract address.");
      return;
    }
    // GATE: require wallet login (and payment if configured) before generating.
    const access = await gate.ensureAccess();
    if (!access.ok) {
      setError(access.reason);
      return;
    }
    setLoading(true);
    try {
      const data = await generate({
        ca: ca.trim(),
        chain: chain || undefined,
        tone: tone as Tone,
        language: lang,
        withHashtags,
        replyTo: tone === "reply" ? replyTo.trim() || undefined : undefined,
      });
      setResult(data);

      // Risk Mode: also pull a token security report and show it as a table.
      setRisk(null);
      if (tone === "risk") {
        setRiskLoading(true);
        getSecurity(data.market.ca, data.market.chain)
          .then(setRisk)
          .catch(() => setRisk(null))
          .finally(() => setRiskLoading(false));
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyPost() {
    if (!result) return;
    navigator.clipboard.writeText(result.post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const m = result?.market;
  const chg = Number(m?.priceChange24h ?? 0);

  function copyTokenInfo() {
    if (!m) return;
    const lines = [
      `$${m.symbol} — ${m.name}`,
      `Chain: ${m.chain} (${m.source})`,
      `Price: ${usd(m.priceUsd)}`,
      `${m.marketCap == null ? "FDV" : "Market Cap"}: ${usd(m.marketCap ?? m.fdv)}`,
      `24h Volume: ${usd(m.volume24h)}`,
      `Liquidity: ${usd(m.liquidityUsd)}`,
      `24h Change: ${(chg > 0 ? "+" : "") + chg.toFixed(1)}%`,
      `24h Txns: ${m.txns24h.buys} buys / ${m.txns24h.sells} sells`,
      `Age: ${ageStr(m.pairCreatedAt)}`,
      `CA: ${m.ca}`,
      m.url ? `Chart: ${m.url}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 1400);
  }

  async function copyTokenImage() {
    if (!m) return;
    try {
      if (typeof ClipboardItem === "undefined")
        throw new Error("no ClipboardItem");
      // Safari/macOS: pass the Blob PROMISE to ClipboardItem and write within the gesture.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": renderTokenCardBlob(m, chg) }),
      ]);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 1400);
    } catch {
      // Fallback: download the PNG if clipboard image isn't allowed.
      try {
        const blob = await renderTokenCardBlob(m, chg);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${m.symbol}-info.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="wrap">
      <header>
        <div className="brand-wrap">
          <div className="brand">
            SHILL<b>IT</b>AI<span className="blink">_</span>
          </div>
          <div className="sub">
            paste a contract address &rarr; auto-fetch market data &rarr;
            generate post
          </div>
        </div>

        {gate.enabled && (
          <div className="profile">
            {gate.authenticated ? (
              <>
                <button
                  className="profile-chip"
                  onClick={() => setProfileOpen((o) => !o)}
                >
                  <span
                    className="avatar"
                    style={{ background: avatarGradient(gate.address) }}
                  />
                  <span className="profile-addr">
                    {gate.address
                      ? `${gate.address.slice(0, 6)}…${gate.address.slice(-4)}`
                      : "Wallet"}
                  </span>
                  <span className="profile-caret">▾</span>
                </button>
                {profileOpen && (
                  <div className="profile-menu">
                    <div className="profile-menu-label">Connected wallet</div>
                    <div className="profile-menu-addr">
                      {gate.address ?? "—"}
                    </div>
                    <button
                      className="profile-menu-btn"
                      onClick={copyAddress}
                      disabled={!gate.address}
                    >
                      {copiedAddr ? "Copied ✓" : "Copy address"}
                    </button>
                    <button
                      className="profile-menu-btn danger"
                      onClick={() => {
                        setProfileOpen(false);
                        gate.logout();
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button className="profile-connect" onClick={gate.login}>
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </header>

      {SHILLIT_CA && (
        <div className="ca-bar">
          <span className="ca-label">$SHILLIT CA</span>
          <span className="ca-value">{SHILLIT_CA}</span>
          <button className="ca-copy" onClick={copyShillitCa}>
            {copiedCa ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}

      <div className="modebar">
        <button
          className={"modetab" + (mode === "profile" ? " on" : "")}
          onClick={() => setMode("profile")}
          disabled={!ENABLE_PROFILE}
          title={ENABLE_PROFILE ? undefined : "Disabled"}
        >
          Profile
        </button>
        <button
          className={"modetab" + (mode === "manual" ? " on" : "")}
          onClick={() => setMode("manual")}
        >
          Manual
        </button>
        <button
          className={"modetab" + (mode === "scheduler" ? " on" : "")}
          onClick={() => ENABLE_SCHEDULER && setMode("scheduler")}
          disabled={!ENABLE_SCHEDULER}
          title={ENABLE_SCHEDULER ? undefined : "Coming soon"}
        >
          Auto Scheduler{" "}
          {!ENABLE_SCHEDULER && <span className="soon">SOON</span>}
        </button>
      </div>

      {mode === "profile" && ENABLE_PROFILE && <Profile />}

      {mode === "scheduler" && ENABLE_SCHEDULER && <Scheduler />}

      {mode === "manual" && (
        <>
          <div className="panel">
            <div className="ca-field">
              <label htmlFor="ca">Contract Address (CA)</label>
              <input
                id="ca"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="0x...  or  Solana base58 address"
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) onGenerate();
                }}
              />
            </div>

            <div className="row">
              <div className="third">
                <label htmlFor="chain">Chain</label>
                <select
                  id="chain"
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                >
                  {CHAINS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="third">
                <label htmlFor="tone">Mode</label>
                <select
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {MODES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="third">
                <label htmlFor="lang">Language</label>
                <select
                  id="lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                >
                  <option value="en">English</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="de">Deutsch (German)</option>
                </select>
              </div>
            </div>

            {tone === "reply" && (
              <div className="ca-field" style={{ marginTop: 16 }}>
                <label htmlFor="replyTo">
                  Reply to (paste the tweet / post)
                </label>
                <textarea
                  id="replyTo"
                  rows={3}
                  placeholder="Paste the tweet or comment you want to reply to…"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
            )}

            <label className={"toggle-row" + (withHashtags ? " on" : "")}>
              <div className="toggle-text">
                <span className="toggle-title">
                  <b>#</b> With Hashtags
                </span>
                <span className="toggle-desc">
                  Auto-add relevant crypto / token tags
                </span>
              </div>
              <input
                type="checkbox"
                checked={withHashtags}
                onChange={(e) => setWithHashtags(e.target.checked)}
              />
              <span className="switch">
                <span className="knob" />
              </span>
            </label>

            <button className="go" onClick={onGenerate} disabled={loading}>
              {loading ? <span className="dots">FETCHING</span> : "GENERATE"}
            </button>

            {gate.enabled && !gate.authenticated && (
              <div className="gate-meta">
                <span className="x-dim">
                  wallet required — connect on generate
                </span>
              </div>
            )}
          </div>

          {error && <div className="err">✕ {error}</div>}

          {result && m && (
            <div className="out">
              <div className="panel">
                <div className="tokline">
                  <span className="tok-sym">${m.symbol}</span>
                  <span className="tok-name">{m.name}</span>
                  <span className="tag">
                    {m.source} · {m.chain}
                  </span>
                  <button className="copy tok-copy" onClick={copyTokenInfo}>
                    {copiedInfo ? "Copied ✓" : "Copy info"}
                  </button>
                  <button className="copy tok-copy2" onClick={copyTokenImage}>
                    {copiedImg ? "Copied ✓" : "Copy image"}
                  </button>
                </div>

                <div className="grid">
                  <div className="cell">
                    <div className="k">Price</div>
                    <div className="v">{usd(m.priceUsd)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">MCap / FDV</div>
                    <div className="v">
                      {usd(m.marketCap ?? m.fdv)}
                      {m.marketCap == null ? " (FDV)" : ""}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="k">24h Vol</div>
                    <div className="v">{usd(m.volume24h)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">Liquidity</div>
                    <div className="v">{usd(m.liquidityUsd)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">24h Change</div>
                    <div className={"v " + (chg >= 0 ? "up" : "down")}>
                      {(chg > 0 ? "+" : "") + chg.toFixed(1)}%
                    </div>
                  </div>
                  <div className="cell">
                    <div className="k">24h Txns</div>
                    <div className="v">
                      {m.txns24h.buys} / {m.txns24h.sells}
                    </div>
                  </div>
                  <div className="cell" style={{ gridColumn: "1 / -1" }}>
                    <div className="k">Age</div>
                    <div className="v">{ageStr(m.pairCreatedAt)}</div>
                  </div>
                </div>

                {/* Live price chart sits directly above Generated Post */}
                <PriceChart market={m} />

                <div className="post-head" style={{ marginTop: 18 }}>
                  <span>Generated Post</span>
                  <button className="copy" onClick={copyPost}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div className="post">{result.post}</div>

                {tone === "risk" && (
                  <div className="risk-card">
                    <div className="risk-head">
                      <span>Security Check</span>
                      {risk && (
                        <span className={"risk-overall " + risk.overall.level}>
                          Overall Risk: {risk.overall.label}
                        </span>
                      )}
                    </div>
                    {riskLoading ? (
                      <div className="risk-loading">Scanning contract…</div>
                    ) : risk && risk.rows.length ? (
                      <table className="risk-table">
                        <tbody>
                          {risk.rows.map((r) => (
                            <tr key={r.key}>
                              <td className="risk-label">{r.label}</td>
                              <td className={"risk-value " + r.level}>
                                <span className="risk-dot" /> {r.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="risk-loading">
                        {risk?.note ??
                          "Security data unavailable for this token."}
                      </div>
                    )}
                    {risk?.note && risk.rows.length > 0 && (
                      <div className="risk-note">{risk.note}</div>
                    )}
                    <div className="risk-note">
                      Source: GoPlus · automated checks, not a guarantee. DYOR.
                    </div>
                  </div>
                )}

                <PostToX
                  text={result.post}
                  onConfigure={() => ENABLE_PROFILE && setMode("profile")}
                />
              </div>
            </div>
          )}
        </>
      )}

      <footer>
        <div className="social">
          <a
            className="social-ico"
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            title="X"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            className="social-ico"
            href={FARCASTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Farcaster"
            title="Farcaster"
          >
            <svg
              viewBox="0 0 1000 1000"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M257.778 155.556h484.444v688.889h-71.111V528.889h-.697c-7.86-87.212-81.156-155.556-170.434-155.556s-162.574 68.344-170.434 155.556h-.697v315.556h-71.111z" />
              <path d="M128.889 253.333l28.889 97.778h24.444v395.556c-12.273 0-22.222 9.949-22.222 22.222v26.667h-4.444c-12.273 0-22.222 9.949-22.222 22.222v26.667h248.889v-26.667c0-12.273-9.949-22.222-22.222-22.222h-4.444v-26.667c0-12.273-9.949-22.222-22.222-22.222h-26.667V253.333z" />
              <path d="M675.556 746.667c-12.273 0-22.222 9.949-22.222 22.222v26.667h-4.444c-12.273 0-22.222 9.949-22.222 22.222v26.667h248.889v-26.667c0-12.273-9.949-22.222-22.222-22.222h-4.444v-26.667c0-12.273-9.949-22.222-22.222-22.222V351.111h24.444l28.889-97.778h-160v493.333z" />
            </svg>
          </a>
        </div>
        Posts are grounded in live on-chain data with a "Not financial advice.
        DYOR." disclaimer. You are responsible for disclosure &amp;
        platform/regulatory compliance when publishing.
      </footer>
    </div>
  );
}
