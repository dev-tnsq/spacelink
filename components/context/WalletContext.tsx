"use client"
 
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
 
type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  // connect may be called with a URI string or as a React onClick handler
  connect: (arg?: string | React.MouseEvent) => Promise<void>;
  disconnect: () => Promise<void>;
  preferredChainId: number | null;
  isOnPreferredChain: boolean;
  providerPresent: boolean;
  lastError: string | null;
  switchToPreferredChain: () => Promise<void>;
  // extras for consumers that want to know initialization state
  initialized: boolean;
  initError: string | null;
};
 
const WalletContext = createContext<WalletContextValue | undefined>(undefined);
 
// Module-scoped singletons so WalletKit/Core are shared across component instances.
let sharedWalletKit: any = null;
let sharedCore: any = null;
let _initPromise: Promise<void> | null = null;
 
/**
 * Initialize WalletKit + Core once. This function is intentionally defensive:
 * - dynamic imports prevent bundlers from eagerly evaluating potentially incompatible CJS/ESM runtime shapes
 * - the initializer catches and logs errors so the app continues to work if WalletConnect is unavailable
 * - we attempt to pass a tiny "no-op" logger to Core so a missing createLogger export is less likely to crash the app
 */
async function initWalletKit(projectId: string, metadata: any) {
  if (sharedWalletKit) return;
  if (_initPromise) return _initPromise;
 
  _initPromise = (async () => {
    try {
      const [CoreModule, WalletKitModule] = await Promise.all([import("@walletconnect/core"), import("@reown/walletkit")]);
 
      const CoreCtor = (CoreModule as any).Core ?? (CoreModule as any).default ?? CoreModule;
      const WalletKitCtor = (WalletKitModule as any).WalletKit ?? (WalletKitModule as any).default ?? WalletKitModule;
 
      // a minimal no-op logger we pass to the Core constructor when possible.
      // this reduces the chance Core will attempt to call a missing createLogger export in some mismatched installs.
      const noop = () => {};
      const minimalLogger = { debug: noop, info: noop, warn: noop, error: noop };
 
      let core: any;
      try {
        core = new CoreCtor({ projectId, logger: minimalLogger });
      } catch (innerErr) {
        // Some Core builds may not accept a logger option. Fall back to the simplest constructor.
        core = new CoreCtor({ projectId });
      }
      sharedCore = core;
 
      const walletKit = await WalletKitCtor.init({ core, metadata });
      sharedWalletKit = walletKit;
    } catch (e) {
      // Never throw during app bootstrap. Log and continue so the rest of the app works.
      // eslint-disable-next-line no-console
      console.error("[Wallet] initWalletKit failed:", e);
    }
  })();
 
  return _initPromise;
}
 
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const parseEnvChainId = (val?: string | undefined) => {
    if (!val) return null;
    try {
      if (val.startsWith("0x")) return parseInt(val, 16);
      return parseInt(val, 10);
    } catch {
      return null;
    }
  };
 
  const preferredChainId = parseEnvChainId(process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_ID);
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
 
  const defaultMetadata = {
    name: "Spacelink Wallet",
    description: "Spacelink web wallet integration",
    url: typeof window !== "undefined" ? window.location.origin : "https://spacelink.local",
    icons: [],
  };
 
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
 
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initWalletKit(projectId, defaultMetadata);
        if (!mounted) return;
        setInitialized(!!sharedWalletKit);
      } catch (e: any) {
        if (!mounted) return;
        setInitError(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);
 
  return (
    <_WalletInner preferredChainId={preferredChainId} initialized={initialized} initError={initError}>
      {children}
    </_WalletInner>
  );
}
 
function _WalletInner({
  children,
  preferredChainId,
  initialized,
  initError,
}: {
  children: React.ReactNode;
  preferredChainId: number | null;
  initialized: boolean;
  initError: string | null;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
 
  // Attach to WalletKit session events when available.
  useEffect(() => {
    if (!sharedWalletKit && typeof (window as any).ethereum === "undefined") return;
 
    const onSession = () => {
      try {
        const sessions = sharedWalletKit.getActiveSessions?.() || [];
        if (sessions.length > 0) {
          const s = sessions[0];
          const accounts = s?.namespaces?.eip155?.accounts || [];
          if (accounts.length > 0) {
            const parts = accounts[0].split(":");
            // e.g. "eip155:1:0xabc..."
            const maybeChain = parts[1] ? parseInt(parts[1], 10) : null;
            setChainId(maybeChain);
            setAddress(parts[2] ?? null);
          }
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("[Wallet] onSession error", e);
      }
    };
 
    try {
      if (sharedWalletKit) {
        sharedWalletKit.on?.("session_proposal", onSession);
        sharedWalletKit.on?.("session_update", onSession);
        sharedWalletKit.on?.("session_delete", () => {
          setAddress(null);
          setChainId(null);
        });
      } else if (typeof (window as any).ethereum !== "undefined") {
        const provider = (window as any).ethereum;
        // populate initial state
        (async () => {
          try {
            const accounts: string[] = await provider.request({ method: "eth_accounts" });
            if (accounts && accounts.length > 0) setAddress(accounts[0]);
            const chainHex = await provider.request({ method: "eth_chainId" });
            if (chainHex) setChainId(parseInt(chainHex.toString(), 16));
          } catch (err) {
            // ignore
          }
        })();

        const handleAccounts = (accounts: string[]) => setAddress(accounts[0] ?? null);
        const handleChain = (chainHex: string) => setChainId(chainHex ? parseInt(chainHex.toString(), 16) : null);
        try {
          provider.on?.("accountsChanged", handleAccounts);
          provider.on?.("chainChanged", handleChain);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore listener attach errors
    }
 
    // Hydrate initial state from any existing active session(s).
    onSession();
 
    return () => {
      try {
        if (sharedWalletKit) {
          sharedWalletKit.off?.("session_proposal", onSession);
          sharedWalletKit.off?.("session_update", onSession);
        } else if (typeof (window as any).ethereum !== "undefined") {
          const provider = (window as any).ethereum;
          provider.removeListener?.("accountsChanged", (a: any) => setAddress(a[0] ?? null));
          provider.removeListener?.("chainChanged", (c: any) => setChainId(c ? parseInt(c.toString(), 16) : null));
        }
      } catch (e) {}
    };
  }, [initialized]);
 
  async function ensureInitialized() {
    if (sharedWalletKit) return;
    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
      const metadata = {
        name: "Spacelink Wallet",
        description: "Spacelink web wallet integration",
        url: typeof window !== "undefined" ? window.location.origin : "https://spacelink.local",
        icons: [],
      };
      await initWalletKit(projectId, metadata);
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
    }
  }
 
  async function connect(arg?: string | React.MouseEvent) {
    setLastError(null);
    try {
      await ensureInitialized();

      // If a string argument was provided, interpret it as either a WalletConnect URI
      // or a command. Prefer WalletKit when available; otherwise fall back to injected providers.
      if (typeof arg === "string") {
        const trimmed = arg.trim();
        const isWcUri = trimmed.toLowerCase().startsWith("wc:");

        if (isWcUri) {
          if (sharedWalletKit) {
            await sharedWalletKit.pair?.({ uri: trimmed });
          } else {
            setLastError("WalletKit not initialized — cannot pair with WalletConnect URI");
          }
          return;
        }

        if (["walletconnect", "wallet", "open", "picker", "modal"].includes(trimmed.toLowerCase())) {
          if (sharedWalletKit && typeof sharedWalletKit.open === "function") {
            await sharedWalletKit.open();
            return;
          }
          // fallback to injected provider UI
          if (typeof (window as any).ethereum !== "undefined") {
            try {
              const provider = (window as any).ethereum;
              const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
              if (accounts && accounts.length > 0) setAddress(accounts[0]);
            } catch (e: any) {
              setLastError(e?.message ?? String(e));
            }
            return;
          }
          setLastError("No WalletKit and no injected wallet found to open");
          return;
        }

        setLastError("Invalid pairing URI or command");
        return;
      }

      // No-arg connect: prefer opening the WalletKit UI; otherwise try injected provider.
      if (sharedWalletKit && typeof sharedWalletKit.open === "function") {
        await sharedWalletKit.open();
        return;
      }

      if (typeof (window as any).ethereum !== "undefined") {
        try {
          const provider = (window as any).ethereum;
          const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0]);
            try {
              const chainHex = await provider.request({ method: "eth_chainId" });
              setChainId(chainHex ? parseInt(chainHex.toString(), 16) : null);
            } catch (e) {}
          }
        } catch (e: any) {
          setLastError(e?.message ?? String(e));
          // eslint-disable-next-line no-console
          console.error("[Wallet] injected connect error", e);
        }
      }
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
      // eslint-disable-next-line no-console
      console.error("[Wallet] connect error", e);
    }
  }
 
  async function disconnect() {
    setLastError(null);
    try {
      if (!sharedWalletKit) return;
      const sessions = sharedWalletKit.getActiveSessions?.() || [];
      for (const s of sessions) {
        try {
          try {
            const utils = await import("@walletconnect/utils");
            const anyUtils = utils as any;
            const getSdkError = anyUtils.getSdkError ?? anyUtils.default?.getSdkError;
            const reason = typeof getSdkError === "function" ? getSdkError("USER_DISCONNECTED") : { message: "USER_DISCONNECTED" };
            await sharedWalletKit.disconnectSession?.({ topic: s.topic, reason });
          } catch {
            await sharedWalletKit.disconnectSession?.({ topic: s.topic, reason: { message: "USER_DISCONNECTED" } });
          }
        } catch (innerErr) {
          // eslint-disable-next-line no-console
          console.error("[Wallet] disconnect session error", innerErr);
        }
      }
      setAddress(null);
      setChainId(null);
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
    }
  }
 
  async function switchToPreferredChain() {
    // Try to switch the user's wallet to the configured preferred chain (Creditcoin).
    if (!preferredChainId) {
      setLastError("No preferred chain configured");
      return;
    }

    const hex = `0x${preferredChainId.toString(16)}`;

    // If an injected provider exists (MetaMask etc.), ask it to switch.
    const provider = (window as any).ethereum;
    if (provider) {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
        setChainId(preferredChainId);
        return;
      } catch (err: any) {
        // 4902 means the chain has not been added to the wallet; try to add it if we have RPC details.
        const rpc = process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL;
        const chainName = process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_NAME || "Creditcoin";
        const symbol = process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_SYMBOL || "CTC";
        if (err && err.code === 4902 && rpc) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hex,
                  chainName,
                  nativeCurrency: { name: symbol, symbol, decimals: 18 },
                  rpcUrls: [rpc],
                },
              ],
            });
            // after adding, attempt to switch again
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
            setChainId(preferredChainId);
            return;
          } catch (addErr: any) {
            setLastError(addErr?.message ?? String(addErr));
            return;
          }
        }
        setLastError(err?.message ?? String(err));
        return;
      }
    }

    // If WalletKit is available and offers a programmatic chain-switch API, that can be added here.
    setLastError("No injected wallet available to switch chains");
  }
 
  const ctx: WalletContextValue = useMemo(
    () => ({
      address,
      chainId,
      connect,
      disconnect,
      preferredChainId,
      isOnPreferredChain: !!(preferredChainId && chainId === preferredChainId),
      switchToPreferredChain,
      providerPresent: typeof window !== "undefined",
      lastError,
      initialized,
      initError,
    }),
    [address, chainId, preferredChainId, lastError, initialized, initError]
  );
 
  return <WalletContext.Provider value={ctx}>{children}</WalletContext.Provider>;
}
 
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
