import { useEffect, useState } from "react";
import {
  connectX,
  createJob,
  deleteJob,
  getXConfig,
  getXStatus,
  listJobs,
  patchJob,
  saveXConfig,
  XPostError,
  type Job,
  type XConfigView,
} from "./xPost";

const CHAINS = ["", "eth", "bsc", "base", "arbitrum", "polygon", "solana"];
const TONES = ["hype", "degen", "professional", "ct", "reply"];

function fmtIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "due now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m}m`;
  return `in ${Math.round(m / 60)}h`;
}

export default function Scheduler() {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [limits, setLimits] = useState({ minIntervalSec: 300, maxPosts: 100 });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // connect form
  const [showForm, setShowForm] = useState(false);
  const [cfg, setCfg] = useState<XConfigView | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [scopes, setScopes] = useState("");

  // job form
  const [ca, setCa] = useState("");
  const [chain, setChain] = useState("");
  const [tone, setTone] = useState("hype");
  const [language, setLanguage] = useState("en");
  const [withHashtags, setWithHashtags] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [total, setTotal] = useState(5);

  async function refreshStatus() {
    const s = await getXStatus();
    setConnected(s.connected);
    setConfigured(s.configured);
    setUsername(s.username);
  }
  async function refreshJobs() {
    const v = await listJobs();
    setJobs(v.jobs);
    setLimits(v.limits);
    setIntervalMin((m) => Math.max(m, Math.ceil(v.limits.minIntervalSec / 60)));
  }

  useEffect(() => {
    refreshStatus();
    refreshJobs();
    const t = setInterval(refreshJobs, 15000); // live job progress
    return () => clearInterval(t);
  }, []);

  async function openForm() {
    const c = await getXConfig();
    setCfg(c);
    setClientId(c.clientId ?? "");
    setClientSecret("");
    setCallbackUrl(c.callbackUrl);
    setScopes(c.scopes);
    setShowForm(true);
  }

  async function connect() {
    setErr(null);
    try {
      if (!configured) {
        if (!showForm) return openForm();
        await saveXConfig({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          callbackUrl: callbackUrl.trim(),
          scopes: scopes.trim(),
        });
        setConfigured(true);
        setShowForm(false);
      }
      await connectX();
      await refreshStatus();
    } catch (e) {
      setErr(e instanceof XPostError ? e.message : (e as Error).message);
    }
  }

  async function submitJob() {
    setErr(null);
    setBusy(true);
    try {
      await createJob({
        ca: ca.trim(),
        chain: chain || undefined,
        tone,
        language,
        withHashtags,
        intervalSec: Math.round(intervalMin * 60),
        total,
      });
      setCa("");
      await refreshJobs();
    } catch (e) {
      setErr(e instanceof XPostError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const minMin = Math.ceil(limits.minIntervalSec / 60);

  return (
    <div className="sched">
      {/* connection state */}
      <div className="panel">
        <div className="sched-conn">
          <span>
            {connected ? (
              <>
                X connected as <b className="acc">@{username}</b>
              </>
            ) : (
              <span className="x-dim">
                Auto-posting needs your X account connected.
              </span>
            )}
          </span>
          {!connected && (
            <button className="x-save" onClick={connect}>
              {configured
                ? "Connect X"
                : showForm
                  ? "Save & Connect"
                  : "Set up X"}
            </button>
          )}
        </div>

        {showForm && !connected && (
          <div className="x-form" style={{ marginTop: 14 }}>
            <p className="x-form-note">
              Your X developer app (OAuth 2.0, Read and write). Register this
              Callback in your X app: <code>{cfg?.defaultCallback}</code>
            </p>
            <label>Client ID</label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
            <label>Client Secret</label>
            <input
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              type="password"
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {/* job creation form */}
      <div
        className="panel"
        style={{
          marginTop: 18,
          opacity: connected ? 1 : 0.5,
          pointerEvents: connected ? "auto" : "none",
        }}
      >
        <div className="sched-title">New auto-post job</div>
        <label htmlFor="sca">Contract Address (CA)</label>
        <input
          id="sca"
          value={ca}
          onChange={(e) => setCa(e.target.value)}
          placeholder="0x... or Solana address"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="row">
          <div className="third">
            <label>Chain</label>
            <select value={chain} onChange={(e) => setChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c === "" ? "Auto" : c}
                </option>
              ))}
            </select>
          </div>
          <div className="third">
            <label>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="third">
            <label>Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div className="third">
            <label>Interval (minutes, min {minMin})</label>
            <input
              type="number"
              min={minMin}
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
            />
          </div>
          <div className="third">
            <label># Posts (max {limits.maxPosts})</label>
            <input
              type="number"
              min={1}
              max={limits.maxPosts}
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
            />
          </div>
          <div
            className="third"
            style={{ display: "flex", alignItems: "flex-end" }}
          >
            <label
              className="toggle-row"
              style={{ marginTop: 0, padding: "10px 12px", width: "100%" }}
            >
              <div className="toggle-text">
                <span className="toggle-title">
                  <b>#</b> Hashtags
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
          </div>
        </div>

        <button
          className="go"
          onClick={submitJob}
          disabled={busy || !ca.trim()}
        >
          {busy ? "Creating…" : "Start Scheduler"}
        </button>
        <p className="x-dim" style={{ marginTop: 10, fontSize: 11 }}>
          Each run regenerates a fresh post (no duplicates) and posts to X.
          Costs Gemini + X API credits per post.
        </p>
      </div>

      {err && (
        <div className="err" style={{ marginTop: 16 }}>
          ✕ {err}
        </div>
      )}

      {/* jobs list */}
      {jobs.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="sched-title">Jobs</div>
          {jobs.map((j) => (
            <div key={j.id} className="jobrow">
              <div className="jobmain">
                <span className={"jobbadge " + j.status}>{j.status}</span>
                <span className="jobca">
                  {j.ca.slice(0, 6)}…{j.ca.slice(-4)}
                </span>
                <span className="x-dim">
                  {j.tone} · {j.language} · every{" "}
                  {Math.round(j.intervalSec / 60)}m
                </span>
              </div>
              <div className="jobmeta">
                <span>
                  {j.total - j.remaining}/{j.total} posted
                </span>
                {j.status === "active" && (
                  <span className="x-dim">· next {fmtIn(j.nextRun)}</span>
                )}
                {j.lastPostUrl && (
                  <a
                    href={j.lastPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    last ↗
                  </a>
                )}
                {j.lastError && (
                  <span className="down" title={j.lastError}>
                    · error
                  </span>
                )}
              </div>
              <div className="jobactions">
                {j.status === "active" && (
                  <button
                    className="x-link"
                    onClick={() => patchJob(j.id, "paused").then(refreshJobs)}
                  >
                    pause
                  </button>
                )}
                {j.status === "paused" && (
                  <button
                    className="x-link"
                    onClick={() => patchJob(j.id, "active").then(refreshJobs)}
                  >
                    resume
                  </button>
                )}
                <button
                  className="x-link"
                  onClick={() => deleteJob(j.id).then(refreshJobs)}
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
