// gateConfig.ts
// All knobs for the wallet-login gate + (future) pay-per-generate, read from
// build-time env. Set these in shill-gen-ui/.env.

// Privy App ID (from the Privy dashboard). If EMPTY, the gate is disabled and the
// app behaves exactly as before (generate is open) — so nothing breaks until you
// actually configure Privy.
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? "";

// Price charged per generate, in NATIVE token units (e.g. ETH). 0 = login-gate
// only, no on-chain charge. When > 0, ensureAccess() sends this amount to
// PAYMENT_RECIPIENT before allowing the generate (test on a testnet first!).
export const GENERATE_PRICE = Number(
  import.meta.env.VITE_GENERATE_PRICE ?? "0",
);

export const GENERATE_CURRENCY =
  import.meta.env.VITE_GENERATE_CURRENCY ?? "ETH";

// Where the per-generate payment goes (your wallet/treasury). Required if price > 0.
export const PAYMENT_RECIPIENT = (import.meta.env.VITE_PAYMENT_RECIPIENT ??
  "") as string;

// Chain the payment runs on (1 = Ethereum mainnet, 8453 = Base, 137 = Polygon…).
export const PAYMENT_CHAIN_ID = Number(
  import.meta.env.VITE_PAYMENT_CHAIN_ID ?? "1",
);

// Shillit AI's own token contract address, shown in the UI (read-only display).
// Leave empty to hide the CA bar.
export const SHILLIT_CA = (import.meta.env.VITE_SHILLIT_CA ?? "") as string;

// ---------------------------------------------------------------------------
// Feature toggles — set to Y or N in .env (case-insensitive). Anything else
// falls back to the default shown here.
//   VITE_ENABLE_PROFILE=Y      -> show/enable the Profile tab
//   VITE_ENABLE_SCHEDULER=N    -> Auto Scheduler tab (disabled by default)
// ---------------------------------------------------------------------------
function yn(v: string | undefined, def: boolean): boolean {
  const s = (v ?? "").trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1", "ON"].includes(s)) return true;
  if (["N", "NO", "FALSE", "0", "OFF"].includes(s)) return false;
  return def;
}
export const ENABLE_PROFILE = yn(import.meta.env.VITE_ENABLE_PROFILE, true);
export const ENABLE_SCHEDULER = yn(
  import.meta.env.VITE_ENABLE_SCHEDULER,
  false,
);

// Allow editing X credentials (Client ID / Secret) from the Profile tab.
// Default N: credentials can be SET once (inline, from the Post-to-X panel) but
// not edited afterwards until you flip this to Y.
export const ENABLE_CRED_EDIT = yn(
  import.meta.env.VITE_ENABLE_CRED_EDIT,
  false,
);

// Footer social links. Set these to your own profiles; they default to the
// platform homepages so the icons are always visible.
export const X_URL = (import.meta.env.VITE_X_URL ?? "https://x.com") as string;
export const FARCASTER_URL = (import.meta.env.VITE_FARCASTER_URL ??
  "https://warpcast.com") as string;

// ---------------------------------------------------------------------------
// Mode (tone) list for the dropdown. Parameterized so adding a mode = editing
// one env var; no code change needed for the UI.
//   VITE_MODES="hype:Hype,degen:Degen,custom:My Custom Mode"
// Format: comma-separated "value:Label" pairs. If a pair has no ":", the value
// is reused as the label (capitalized).
// NOTE: a brand-new value also needs a matching voice in the BACKEND
// (gemini.ts TONE_GUIDE + VALID_TONES) to behave distinctly — otherwise the
// server falls back to the default "hype" voice for unknown modes.
// ---------------------------------------------------------------------------
export interface ModeOption {
  value: string;
  label: string;
}
const DEFAULT_MODES =
  "hype:Hype,degen:Degen,professional:Professional,ct:CT Style,analysis:Analysis,risk:Risk Mode,reply:Comment / Reply";

export const MODES: ModeOption[] = (import.meta.env.VITE_MODES ?? DEFAULT_MODES)
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean)
  .map((pair: string) => {
    const i = pair.indexOf(":");
    if (i === -1) {
      const v = pair.trim();
      return { value: v, label: v.charAt(0).toUpperCase() + v.slice(1) };
    }
    return { value: pair.slice(0, i).trim(), label: pair.slice(i + 1).trim() };
  });
