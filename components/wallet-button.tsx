"use client"

import { useState } from "react";
import { useWallet } from "@/components/context/WalletContext";

export default function WalletButton() {
  const { address, chainId, connect, disconnect, providerPresent, lastError } = useWallet();
  const [open, setOpen] = useState(false);

  function short(addr: string) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  if (!address) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => connect && connect()}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-sm font-semibold
                     bg-amber-500 text-black border border-amber-600/30
                     hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="#000" opacity="0.06" />
            <path d="M7 11c0-1.657 1.343-3 3-3h4" stroke="#111827" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">Connect</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-sm font-medium bg-slate-800 text-slate-100
                   border border-slate-700 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M4 7h16v10H4z" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs text-slate-300">{chainId ? `Chain ${chainId}` : 'Chain'}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 4v16M4 12h16" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-900/70 backdrop-blur-sm border border-slate-800/40 rounded-sm p-3">
          <div className="text-xs text-slate-400 mb-2">Address</div>
          <div className="text-sm text-slate-200 break-all mb-3">{address}</div>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(address || ''); }} className="px-3 py-1 text-sm rounded-sm bg-slate-800 hover:bg-slate-800/60">Copy</button>
            <button onClick={() => { disconnect(); setOpen(false); }} className="px-3 py-1 text-sm rounded-sm bg-red-700 text-white hover:bg-red-600">Disconnect</button>
          </div>
        </div>
      )}
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute -right-2 top-full mt-1 text-xs">
          <span className={`px-2 py-0.5 rounded-sm text-[10px] ${providerPresent ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
            {providerPresent ? 'provider' : 'no-provider'}
          </span>
          {lastError && <span className="ml-2 text-[10px] text-amber-300">{lastError}</span>}
        </div>
      )}
    </div>
  );
}
