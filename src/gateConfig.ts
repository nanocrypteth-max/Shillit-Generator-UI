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
