import { useEffect, useRef, useState } from "react";
import { fetchChart } from "./api";
import type { ChartPoint, TokenMarket } from "./types";

const POLL_MS = 30_000;
const WATERMARK = "SHILLIT.AI";

// On-screen sparkline dims
const SW = 660,
  SH = 90,
  SPAD = 6;
// Export card dims
const EW = 760,
  EH = 460;

const TIMEFRAMES = [
  { tf: "minute" as const, label: "5m" },
  { tf: "hour" as const, label: "1H" },
  { tf: "day" as const, label: "1D" },
];

interface Props {
  market: TokenMarket;
}

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

// Map points into a box -> {line, area} path strings + up flag + pct
function paths(
  points: ChartPoint[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const closes = points.map((p) => p.c);
  const min = Math.min(...closes),
    max = Math.max(...closes);
  const span = max - min || 1;
  const first = closes[0] ?? 0,
    last = closes[closes.length - 1] ?? 0;
  const coords = points.map((p, i) => {
    const px = x + (i / Math.max(1, points.length - 1)) * w;
    const py = y + (1 - (p.c - min) / span) * h;
    return [px, py] as const;
  });
  const line = coords
    .map(
      ([cx, cy], i) =>
        `${i === 0 ? "M" : "L"}${cx.toFixed(1)},${cy.toFixed(1)}`,
    )
    .join(" ");
  const area = coords.length
    ? `${line} L${coords[coords.length - 1][0].toFixed(1)},${y + h} L${coords[0][0].toFixed(1)},${y + h} Z`
    : "";
  return {
    line,
    area,
    up: last >= first,
    pct: first ? ((last - first) / first) * 100 : 0,
  };
}

export default function PriceChart({ market }: Props) {
  const { chartNetwork: network, pairAddress: pool, symbol } = market;
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [tf, setTf] = useState<"minute" | "hour" | "day">("hour");
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!pool) return;
    let cancelled = false;
    async function load() {
      try {
        const { points } = await fetchChart(network, pool!, tf);
        if (!cancelled) {
          setPoints(points);
          setErr(points.length ? null : "no data");
          setLive(true);
          setTimeout(() => !cancelled && setLive(false), 800);
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    }
    load();
    timer.current = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [network, pool, tf]);

  if (!pool) {
    return (
      <div className="chart-bar chart-empty">
        <span>No pool address — chart unavailable for this source.</span>
      </div>
    );
  }

  const screen = paths(points, SPAD, SPAD, SW - SPAD * 2, SH - SPAD * 2);
  const stroke = screen.up ? "#b6ff3c" : "#ff5d5d";

  // -------- Export card: full dApp-style image with market stats --------
  function buildSvgString(): string {
    const tfLabel = TIMEFRAMES.find((t) => t.tf === tf)?.label ?? "1H";
    const bx = 28,
      by = 250,
      bw = EW - 56,
      bh = 150;
    const c = paths(points, bx, by + 8, bw, bh - 16);
    const s = c.up ? "#b6ff3c" : "#ff5d5d";
    const esc = (v: string) =>
      v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const chips = [
      [
        "MCAP / FDV",
        usd(market.marketCap ?? market.fdv) +
          (market.marketCap == null ? " (FDV)" : ""),
      ],
      ["24H VOLUME", usd(market.volume24h)],
      ["LIQUIDITY", usd(market.liquidityUsd)],
      ["AGE", ageStr(market.pairCreatedAt)],
      ["24H TXNS", `${market.txns24h.buys} / ${market.txns24h.sells}`],
    ];
    const gap = 10,
      cw = (bw - gap * 4) / 5,
      chy = 150,
      chh = 60;
    const chipSvg = chips
      .map(([label, val], i) => {
        const x = bx + i * (cw + gap);
        return (
          `<rect x="${x}" y="${chy}" width="${cw}" height="${chh}" rx="7" fill="#11161a" stroke="#1d262c"/>` +
          `<text x="${x + 11}" y="${chy + 22}" font-family="monospace" font-size="10" letter-spacing="1" fill="#6c7a78">${label}</text>` +
          `<text x="${x + 11}" y="${chy + 44}" font-family="monospace" font-size="13" font-weight="600" fill="#d6e2dd">${esc(val)}</text>`
        );
      })
      .join("");

    // chart gridlines
    let grid = "";
    for (let i = 1; i < 4; i++) {
      const gy = by + 8 + ((bh - 16) / 4) * i;
      grid += `<line x1="${bx}" y1="${gy}" x2="${bx + bw}" y2="${gy}" stroke="#1d262c" stroke-opacity="0.6"/>`;
    }

    const pct = (c.pct >= 0 ? "+" : "") + c.pct.toFixed(1) + "%";
    const ts = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${EW}" height="${EH}" viewBox="0 0 ${EW} ${EH}">`,
      `<rect x="0.5" y="0.5" width="${EW - 1}" height="${EH - 1}" rx="16" fill="#0d1114" stroke="#1d262c"/>`,
      `<rect x="0.5" y="0.5" width="${EW - 1}" height="4" rx="2" fill="#b6ff3c"/>`,
      // header
      `<text x="28" y="64" font-family="monospace" font-size="30" font-weight="700" fill="#b6ff3c">$${esc(symbol)}</text>`,
      `<text x="28" y="86" font-family="monospace" font-size="13" fill="#6c7a78">${esc(market.name)}</text>`,
      `<text x="28" y="106" font-family="monospace" font-size="11" letter-spacing="1" fill="#6c7a78">${esc(market.chain.toUpperCase())} · ${esc(market.source.toUpperCase())}</text>`,
      `<text x="${EW - 28}" y="60" text-anchor="end" font-family="monospace" font-size="26" font-weight="600" fill="#d6e2dd">${usd(market.priceUsd)}</text>`,
      `<text x="${EW - 28}" y="86" text-anchor="end" font-family="monospace" font-size="15" font-weight="600" fill="${market.priceChange24h >= 0 ? "#b6ff3c" : "#ff5d5d"}">${(market.priceChange24h >= 0 ? "+" : "") + market.priceChange24h.toFixed(1)}% 24h</text>`,
      `<line x1="28" y1="124" x2="${EW - 28}" y2="124" stroke="#1d262c"/>`,
      // chips
      chipSvg,
      // chart label
      `<text x="28" y="240" font-family="monospace" font-size="11" letter-spacing="1" fill="#6c7a78">PRICE · ${tfLabel}</text>`,
      `<text x="${EW - 28}" y="240" text-anchor="end" font-family="monospace" font-size="12" font-weight="600" fill="${s}">${pct}</text>`,
      // chart
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s}" stop-opacity="0.22"/><stop offset="100%" stop-color="${s}" stop-opacity="0"/></linearGradient></defs>`,
      grid,
      `<text x="${bx + bw / 2}" y="${by + bh / 2 + 14}" text-anchor="middle" font-family="monospace" font-size="40" font-weight="700" letter-spacing="6" fill="#b6ff3c" fill-opacity="0.07">${WATERMARK}</text>`,
      `<path d="${c.area}" fill="url(#g)"/>`,
      `<path d="${c.line}" fill="none" stroke="${s}" stroke-width="2"/>`,
      // footer
      `<line x1="28" y1="418" x2="${EW - 28}" y2="418" stroke="#1d262c"/>`,
      `<text x="28" y="442" font-family="monospace" font-size="16" font-weight="700" letter-spacing="3" fill="#b6ff3c">${WATERMARK}</text>`,
      `<text x="${EW - 28}" y="442" text-anchor="end" font-family="monospace" font-size="11" fill="#6c7a78">${ts} · not financial advice</text>`,
      `</svg>`,
    ].join("");
  }

  async function toPngBlob(): Promise<Blob> {
    const url =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(buildSvgString());
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("render failed"));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = EW * scale;
    canvas.height = EH * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, EW, EH);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error("blob failed"))),
        "image/png",
      ),
    );
  }

  async function download() {
    try {
      const blob = await toPngBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${symbol}-${tf}-shillit.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function copy() {
    try {
      if (typeof ClipboardItem === "undefined")
        throw new Error("no ClipboardItem");
      // Safari/macOS: ClipboardItem must receive the Blob PROMISE and write() must be
      // initiated within the user gesture — do NOT await the blob before write().
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": toPngBlob() }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setErr("clipboard blocked — use Download instead");
    }
  }

  const hasChart = points.length >= 2;

  return (
    <div className="chart-bar">
      <div className="chart-head">
        <div className="chart-meta">
          <span className={"live-dot" + (live ? " on" : "")} />
          <span className="chart-title">LIVE PRICE</span>
          {hasChart && (
            <span className={screen.up ? "up" : "down"}>
              {(screen.pct >= 0 ? "+" : "") + screen.pct.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="chart-actions">
          <div className="tf-switch">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.tf}
                className={"tf" + (tf === t.tf ? " active" : "")}
                onClick={() => setTf(t.tf)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="tf lime"
            onClick={download}
            disabled={!hasChart}
            title="Download card PNG"
          >
            ↓ PNG
          </button>
          <button
            className="tf lime"
            onClick={copy}
            disabled={!hasChart}
            title="Copy card image"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      {hasChart ? (
        <div className="spark-wrap">
          <svg
            viewBox={`0 0 ${SW} ${SH}`}
            preserveAspectRatio="none"
            className="spark"
          >
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={screen.area} fill="url(#fill)" />
            <path
              d={screen.line}
              fill="none"
              stroke={stroke}
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="watermark">{WATERMARK}</span>
        </div>
      ) : (
        <div className="chart-empty">
          <span>{err ? `Chart: ${err}` : "Loading chart…"}</span>
        </div>
      )}
    </div>
  );
}
