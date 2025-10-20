"use client"

import React, { createContext, useContext, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem'
import { CREDITCOIN_TESTNET } from '@/lib/contracts'

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  preferredChainId: number | null;
  isOnPreferredChain: boolean;
  providerPresent: boolean;
  lastError: string | null;
  switchToPreferredChain: () => Promise<void>;
  initialized: boolean;
  initError: string | null;
  walletClient: any; // Add wallet client for contract writes
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

// Create public client for reading
const publicClient = createPublicClient({
  chain: CREDITCOIN_TESTNET,
  transport: http(),
})

function WalletContextInner({ children }: { children: React.ReactNode }) {
  const parseEnvChainId = (val?: string | undefined) => {
    if (!val) return null;
    try {
      if (val.startsWith("0x")) return parseInt(val, 16);
      return parseInt(val, 10);
    } catch {
      return null;
    }
  };

  const preferredChainId = parseEnvChainId(process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_ID) || 102031;

  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletClient, setWalletClient] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [providerPresent, setProviderPresent] = useState(false);

  // Check for wallet provider on mount
  useEffect(() => {
    const checkProvider = async () => {
      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          setProviderPresent(true);
          // Try to get current accounts and chain
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });

        if (accounts && accounts.length > 0) {
          const account = accounts[0] as Address;
          setAddress(account);

          // Create wallet client for existing connection (without specifying chain initially)
          const client = createWalletClient({
            account,
            transport: custom(window.ethereum),
          });
          setWalletClient(client);
        }          if (chainIdHex) {
            setChainId(parseInt(chainIdHex, 16));
          }

          // Listen for account changes
          window.ethereum.on('accountsChanged', (accounts: string[]) => {
            setAddress(accounts.length > 0 ? accounts[0] as Address : null);
          });

          // Listen for chain changes
          window.ethereum.on('chainChanged', (chainIdHex: string) => {
            setChainId(parseInt(chainIdHex, 16));
          });
        } else {
          setProviderPresent(false);
        }
      } catch (error) {
        setInitError(error instanceof Error ? error.message : 'Failed to initialize wallet');
      } finally {
        setInitialized(true);
      }
    };

    checkProvider();
  }, []);

  const handleConnect = async () => {
    try {
      setLastError(null);

      if (!window.ethereum) {
        throw new Error('No Ethereum wallet found. Please install MetaMask or another Web3 wallet.');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      if (accounts && accounts.length > 0) {
        const account = accounts[0] as Address;
        setAddress(account);

        // Create wallet client
        const client = createWalletClient({
          account,
          transport: custom(window.ethereum),
        });
        setWalletClient(client);

        // Get current chain
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleDisconnect = async () => {
    try {
      setAddress(null);
      setChainId(null);
      setWalletClient(null);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Disconnection failed');
    }
  };

  const switchToPreferredChain = async () => {
    if (!preferredChainId || !window.ethereum) {
      throw new Error('Preferred chain ID not configured or wallet not available');
    }

    try {
      setLastError(null);

      // Try to switch to the preferred chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${preferredChainId.toString(16)}` }],
      });

      // Update local state
      setChainId(preferredChainId);
    } catch (switchError: any) {
      console.error('Switch chain error:', switchError);
      
      // If the chain is not added, try to add it (error 4902) or if unrecognized chain (check message)
      if (switchError.code === 4902 || (switchError.message && switchError.message.includes('Unrecognized chain ID'))) {
        try {
          console.log('Chain not found, attempting to add it...');
          const addChainResult = await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${preferredChainId.toString(16)}`,
              chainName: CREDITCOIN_TESTNET.name,
              nativeCurrency: CREDITCOIN_TESTNET.nativeCurrency,
              rpcUrls: CREDITCOIN_TESTNET.rpcUrls.default.http,
              blockExplorerUrls: [CREDITCOIN_TESTNET.blockExplorers.default.url],
            }],
          });
          
          console.log('Chain added successfully, result:', addChainResult);
          
          // Update local state - MetaMask automatically switches after adding
          setChainId(preferredChainId);
          
          // Recreate wallet client with the new chain
          if (address) {
            const client = createWalletClient({
              account: address,
              transport: custom(window.ethereum),
            });
            setWalletClient(client);
          }
        } catch (addError: any) {
          console.error('Add chain error:', addError);
          setLastError('Failed to add the network to your wallet');
          throw new Error(`Failed to add Creditcoin Testnet to your wallet: ${addError?.message || 'Unknown error'}`);
        }
      } else if (switchError.code === 4001) {
        // User rejected the request
        setLastError('Network switch rejected by user');
        throw new Error('You rejected the network switch request');
      } else {
        setLastError('Failed to switch network');
        throw new Error(`Failed to switch to Creditcoin Testnet: ${switchError?.message || 'Unknown error'}`);
      }
    }
  };

  const value: WalletContextValue = {
    address: address || null,
    chainId: chainId || null,
    connect: handleConnect,
    disconnect: handleDisconnect,
    preferredChainId,
    isOnPreferredChain: chainId === preferredChainId,
    providerPresent,
    lastError,
    switchToPreferredChain,
    initialized,
    initError,
    walletClient,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WalletContextInner>
      {children}
    </WalletContextInner>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
