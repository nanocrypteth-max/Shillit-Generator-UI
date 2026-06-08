// Mirrors the backend POST /api/generate response shape.

export interface TokenMarket {
  source: string;
  ca: string;
  chain: string;
  symbol: string;
  name: string;
  priceUsd: number;
  fdv: number;
  marketCap: number | null;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  txns24h: { buys: number; sells: number };
  pairCreatedAt: number;
  dexId: string | null;
  url: string | null;
  pairAddress: string | null; // pool address for the chart
  chartNetwork: string; // GeckoTerminal network slug
}

export interface GenerateResponse {
  market: TokenMarket;
  post: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export type Tone =
  | "hype"
  | "degen"
  | "professional"
  | "ct"
  | "reply"
  | "analysis"
  | "risk";
export type Lang = "en" | "zh" | "ja" | "de";

export interface GenerateRequest {
  ca: string;
  chain?: string;
  tone: Tone;
  language: Lang;
  withHashtags: boolean;
  replyTo?: string;
}

export interface ChartPoint {
  t: number;
  c: number;
}
export interface ChartResponse {
  points: ChartPoint[];
}

export type RiskLevel = "ok" | "warn" | "danger" | "unknown";
export interface RiskRow {
  key: string;
  label: string;
  value: string;
  level: RiskLevel;
}
export interface RiskReport {
  ca: string;
  chain: string;
  source: string;
  supported: boolean;
  rows: RiskRow[];
  overall: { level: RiskLevel; label: string };
  note?: string;
}
