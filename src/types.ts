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
  pairAddress: string | null; // pool address -> untuk chart OHLCV
  chartNetwork: string; // slug network GeckoTerminal
}

export interface GenerateResponse {
  market: TokenMarket;
  post: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export type Tone = "hype" | "degen" | "professional" | "ct" | "reply";
export type Lang = "en" | "id";

export interface GenerateRequest {
  ca: string;
  chain?: string;
  tone: Tone;
  language: Lang;
  withHashtags: boolean;
  replyTo?: string;
}

// untuk /api/chart
export interface ChartPoint {
  t: number; // epoch ms
  c: number; // close price USD
}
export interface ChartResponse {
  points: ChartPoint[];
}
