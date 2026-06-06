// gate.tsx
// Wallet-login gate around the Generate action, backed by Privy.
//
// Design:
// - AppProviders wraps the app. If PRIVY_APP_ID is set -> PrivyProvider + PrivyGate
//   (real gate). If not set -> NoGate (gate disabled, app works as before).
// - Components call useGenerateAccess() -> { ready, authenticated, address, login,
//   logout, ensureAccess }. The Generate button calls ensureAccess() before running.
// - ensureAccess(): not ready -> block; not logged in -> open Privy login; logged in
//   and price > 0 -> charge on-chain; else allow.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import {
  PrivyProvider,
  usePrivy,
  useSendTransaction,
} from "@privy-io/react-auth";
import { setPrivyTokenProvider } from "./xPost";
import {
  GENERATE_PRICE,
  PAYMENT_CHAIN_ID,
  PAYMENT_RECIPIENT,
  PRIVY_APP_ID,
} from "./gateConfig";

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
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { sendTransaction } = useSendTransaction();
  const address = (user?.wallet?.address as string | undefined) ?? null;

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
    // ---- Pay-per-generate (only when a price is configured) ----
    if (GENERATE_PRICE > 0) {
      if (!PAYMENT_RECIPIENT)
        return { ok: false, reason: "Payment recipient not configured." };
      try {
        const { parseEther } = await import("viem");
        await sendTransaction({
          to: PAYMENT_RECIPIENT as `0x${string}`,
          value: parseEther(String(GENERATE_PRICE)),
          chainId: PAYMENT_CHAIN_ID,
        });
      } catch (e: any) {
        return {
          ok: false,
          reason: e?.message
            ? `Payment failed: ${e.message}`
            : "Payment cancelled.",
        };
      }
    }
    return { ok: true };
  }, [ready, authenticated, login, sendTransaction]);

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

export default function AppProviders({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <NoGate>{children}</NoGate>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: { theme: "dark", accentColor: "#b6ff3c" },
        loginMethods: ["wallet", "email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PrivyGate>{children}</PrivyGate>
    </PrivyProvider>
  );
}
