// gate.tsx
// Wallet-login gate around the Generate action, backed by Privy (Solana-only).
//
// Design:
// - AppProviders wraps the app. If PRIVY_APP_ID is set -> PrivyProvider + PrivyGate
//   (real gate). If not set -> NoGate (gate disabled, app works as before).
// - Components call useGenerateAccess() -> { ready, authenticated, address, login,
//   logout, ensureAccess }. The Generate button calls ensureAccess() before running.
// - Solana-only: embedded + external wallets are Solana; the wallet modal is
//   restricted to Solana ("solana-only"). Generate is login-only (price = 0).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { setPrivyTokenProvider, logoutX } from "./xPost";
import { GENERATE_PRICE, PRIVY_APP_ID } from "./gateConfig";

export type AccessResult = { ok: true } | { ok: false; reason: string };

export interface Gate {
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  login: () => void;
  logout: () => void;
  ensureAccess: () => Promise<AccessResult>;
}

const Ctx = createContext<Gate | null>(null);

export function useGenerateAccess(): Gate {
  const g = useContext(Ctx);
  if (!g) throw new Error("useGenerateAccess must be used within AppProviders");
  return g;
}

// Gate disabled (no Privy configured): everything is allowed, app unchanged.
function NoGate({ children }: { children: ReactNode }) {
  const value: Gate = {
    enabled: false,
    ready: true,
    authenticated: false,
    address: null,
    login: () => {},
    logout: () => {},
    ensureAccess: async () => ({ ok: true }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Gate enabled: bridge Privy state into the gate context.
function PrivyGate({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    login,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  // Prefer a connected/embedded Solana wallet address; fall back to user.wallet.
  const address =
    solanaWallets?.[0]?.address ??
    (user?.wallet?.chainType === "solana"
      ? (user.wallet.address as string)
      : null) ??
    null;

  // Disconnecting the wallet should also end the X session (token still valid here).
  const logout = async () => {
    try {
      await logoutX();
    } catch {
      /* ignore */
    }
    await privyLogout();
  };

  // Let xPost.ts attach the Privy access token to X API calls, so the backend
  // keys credentials/tokens by this user's identity (not the cookie).
  useEffect(() => {
    setPrivyTokenProvider(() => getAccessToken());
  }, [getAccessToken]);

  const ensureAccess = useCallback(async (): Promise<AccessResult> => {
    if (!ready)
      return {
        ok: false,
        reason: "Wallet not ready yet — try again in a moment.",
      };
    if (!authenticated) {
      login(); // opens Privy modal; user retries Generate after connecting
      return { ok: false, reason: "Connect your wallet to generate." };
    }
    // Paid generate is not wired for Solana yet — keep it login-only (price = 0).
    if (GENERATE_PRICE > 0) {
      return {
        ok: false,
        reason: "Paid generate is not enabled for Solana yet.",
      };
    }
    return { ok: true };
  }, [ready, authenticated, login]);

  const value: Gate = {
    enabled: true,
    ready,
    authenticated,
    address,
    login,
    logout,
    ensureAccess,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const solanaConnectors = toSolanaWalletConnectors();

export default function AppProviders({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <NoGate>{children}</NoGate>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#b6ff3c",
          walletChainType: "solana-only",
        },
        loginMethods: ["wallet", "email"],
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        externalWallets: { solana: { connectors: solanaConnectors } },
      }}
    >
      <PrivyGate>{children}</PrivyGate>
    </PrivyProvider>
  );
}
