"use client"

import React, { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";

export default function BookModal({ open, onClose, nodeId }: { open: boolean; onClose: () => void; nodeId: string | null }) {
  const { satellites, addBooking } = useAppData();
  const [satId, setSatId] = useState<string | null>(satellites.length ? satellites[0].id : null);
  const [start, setStart] = useState<string>(new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16));
  const [end, setEnd] = useState<string>(new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain } = useWallet();

  if (!open) return null;

  async function confirm() {
    setMessage(null);
    if (!nodeId || !satId) {
      setMessage("Select a node and a satellite");
      return;
    }
    // Ensure wallet connected
    if (!address) {
      setMessage("Please connect your wallet to confirm a booking.");
      return;
    }
    // Ensure preferred chain if configured
    if (preferredChainId && !isOnPreferredChain) {
      setMessage("Please switch your wallet to the Creditcoin network before confirming the booking.");
      return;
    }
    setLoading(true);
    try {
      // Simulate network / booking latency
      await new Promise((r) => setTimeout(r, 800));
      const b = addBooking({ nodeId, satId, start: new Date(start).getTime(), end: new Date(end).getTime() });
      setMessage(`Booking created (local demo): ${b.id}`);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e: any) {
      setMessage(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-50 w-full max-w-lg bg-background border border-foreground/10 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Book a Relay Pass (UI demo)</h3>

        <div className="mb-3">
          {!address && (
            <div className="mb-3">
              <button onClick={() => connect()} className="px-3 py-2 bg-primary text-white rounded">Connect Wallet</button>
            </div>
          )}
          <label className="text-xs text-foreground/60">Satellite</label>
          <select value={satId ?? ""} onChange={(e) => setSatId(e.target.value)} className="w-full p-2 rounded-md bg-background/30">
            {satellites.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.id}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-foreground/60">Start</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full p-2 rounded-md bg-background/30" />
          </div>
          <div>
            <label className="text-xs text-foreground/60">End</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full p-2 rounded-md bg-background/30" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-background border rounded">Cancel</button>
          {!address ? (
            <button disabled className="px-4 py-2 bg-primary/30 text-white rounded">Connect wallet to confirm</button>
          ) : !isOnPreferredChain && preferredChainId ? (
            <button onClick={switchToPreferredChain} className="px-4 py-2 bg-amber-600 text-white rounded">Switch to Creditcoin</button>
          ) : (
            <button onClick={confirm} disabled={loading} className="px-4 py-2 bg-primary text-white rounded">{loading ? 'Booking…' : 'Confirm Booking'}</button>
          )}
        </div>

        {message && <div className="mt-3 text-sm text-foreground/70">{message}</div>}
      </div>
    </div>
  );
}
