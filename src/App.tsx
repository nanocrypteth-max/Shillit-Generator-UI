import { useState, useEffect } from "react";
import { generate, ApiException } from "./api";
import PriceChart from "./PriceChart";
import PostToX from "./PostToX";
import Scheduler from "./Scheduler";
import { useGenerateAccess } from "./gate";
import type { GenerateResponse, Tone, Lang } from "./types";

const CHAINS = [
  { value: "", label: "Auto" },
  { value: "eth", label: "Ethereum" },
  { value: "bsc", label: "BSC" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "polygon", label: "Polygon" },
  { value: "solana", label: "Solana" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "hype", label: "Hype" },
  { value: "degen", label: "Degen" },
  { value: "professional", label: "Professional" },
  { value: "ct", label: "CT Style" },
  { value: "reply", label: "Comment / Reply" },
];

function usd(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n <= 0) return "n/a";
  if (n >= 1) return "$" + Math.round(n).toLocaleString("en-US");
  return "$" + Number(n).toPrecision(4);
}

function ageStr(epochMs: number): string {
  if (!epochMs) return "n/a";
  const h = (Date.now() - epochMs) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m old`;
  if (h < 24) return `${Math.round(h)}h old`;
  return `${Math.round(h / 24)}d old`;
}

export default function App() {
  const [mode, setMode] = useState<"manual" | "scheduler">("manual");
  const [ca, setCa] = useState("");
  const [chain, setChain] = useState("");
  const [tone, setTone] = useState<Tone>("hype");
  const [lang, setLang] = useState<Lang>("en");
  const [withHashtags, setWithHashtags] = useState(false);
  const [replyTo, setReplyTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const gate = useGenerateAccess();

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
        tone,
        language: lang,
        withHashtags,
        replyTo: tone === "reply" ? replyTo.trim() || undefined : undefined,
      });
      setResult(data);
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

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          SHILL<b>IT</b>AI<span className="blink">_</span>
        </div>
        <div className="sub">
          paste a contract address &rarr; auto-fetch market data &rarr; generate
          post
        </div>
      </header>

      <div className="modebar">
        <button
          className={"modetab" + (mode === "manual" ? " on" : "")}
          onClick={() => setMode("manual")}
        >
          Manual
        </button>
        <button className="modetab" disabled title="Coming soon">
          Auto Scheduler <span className="soon">SOON</span>
        </button>
      </div>

      {mode === "scheduler" && <Scheduler />}

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
                <label htmlFor="tone">Tone</label>
                <select
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                >
                  {TONES.map((t) => (
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
                  <option value="id">Indonesia</option>
                  <option value="zh">中文 (Chinese)</option>
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

            {gate.enabled && (
              <div className="gate-meta">
                {gate.authenticated ? (
                  <div className="wallet-chip">
                    <span className="wdot" />
                    <span className="waddr">
                      {gate.address
                        ? `${gate.address.slice(0, 6)}…${gate.address.slice(-4)}`
                        : "Connected"}
                    </span>
                    <button
                      className="wchip-btn"
                      onClick={copyAddress}
                      title="Copy address"
                      disabled={!gate.address}
                    >
                      {copiedAddr ? "✓" : "Copy"}
                    </button>
                    <span className="wchip-sep" />
                    <button
                      className="wchip-btn"
                      onClick={gate.logout}
                      title="Disconnect"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <span className="x-dim">
                    wallet required — connect on generate
                  </span>
                )}
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

                <PostToX text={result.post} />
              </div>
            </div>
          )}
        </>
      )}

      <footer>
        Posts are grounded in live on-chain data with a "Not financial advice.
        DYOR." disclaimer. You are responsible for disclosure &amp;
        platform/regulatory compliance when publishing.
      </footer>
    </div>
  );
}
