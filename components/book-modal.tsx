"use client"

import React, { useEffect, useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import { useBookPass } from "@/lib/hooks";
import { fetchIpfsJson, getErc20Allowance, approveErc20, isNativeToken, getTokenDecimals, getTokenSymbol } from '@/lib/hooks';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';

export default function BookModal({ open, onClose, nodeId }: { open: boolean; onClose: () => void; nodeId: string | null }) {
  const { satellites, nodes, addBooking, updateBooking, refreshData } = useAppData();
  const { bookPass, hash, isLoading: contractLoading, isSuccess, error } = useBookPass();
  const { walletClient } = useWallet();
  const [satId, setSatId] = useState<string | null>(satellites.length ? satellites[0].id : null);
  const [start, setStart] = useState<string>(new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16));
  const [end, setEnd] = useState<string>(new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pricePerMinute, setPricePerMinute] = useState<bigint | null>(null);
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<bigint | null>(null);
  const [needApproval, setNeedApproval] = useState(false);
  const [readableTotal, setReadableTotal] = useState<string | null>(null);
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain } = useWallet();

  if (!open) return null;

  // Fetch IPFS pricing when nodeId or satId changes and combine node + satellite prices
  useEffect(() => {
    let mounted = true;
    (async () => {
      setPricePerMinute(null)
      setPaymentToken(null)
      setTotalAmount(null)
      setNeedApproval(false)
      if (!nodeId) return

      try {
        // Try to find node and satellite records from app state
        const node = nodes?.find((n:any) => n.id === nodeId) || (window as any).__mockNodes ? (window as any).__mockNodes.find((n:any) => n.id === nodeId) : null
        const sat = satellites?.find((s:any) => s.id === satId) || null

        let nodePrice: bigint = BigInt(0)
        let satPrice: bigint = BigInt(0)
        let nodeToken: string | null = null
        let satToken: string | null = null

        if (node?.ipfsCID) {
          try {
            const meta = await fetchIpfsJson(node.ipfsCID)
            if (!mounted) return
            if (meta?.pricePerMinute) nodePrice = BigInt(meta.pricePerMinute)
            if (meta?.paymentToken) nodeToken = String(meta.paymentToken)
          } catch (e) {
            // ignore node meta failure
          }
        }

        if (sat?.ipfsCID) {
          try {
            const meta = await fetchIpfsJson(sat.ipfsCID)
            if (!mounted) return
            if (meta?.pricePerMinute) satPrice = BigInt(meta.pricePerMinute)
            if (meta?.paymentToken) satToken = String(meta.paymentToken)
          } catch (e) {
            // ignore sat meta failure
          }
        }

        const combined = nodePrice + satPrice
        setPricePerMinute(combined > BigInt(0) ? combined : null)

        // Payment token priority: node token, then satellite token, then native
        const chosen = nodeToken || satToken || null
        if (chosen) setPaymentToken(chosen)
        else setPaymentToken(null)

      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [nodeId, satId, nodes, satellites])

  // Recompute readable totals whenever start/end or pricePerMinute/paymentToken changes
  useEffect(() => {
    (async () => {
      setReadableTotal(null)
      setTotalAmount(null)
      if (!pricePerMinute) return
      try {
        const startTime = new Date(start).getTime()
        const endTime = new Date(end).getTime()
        const durationMin = Math.max(0, Math.floor((endTime - startTime) / (1000 * 60)))
        const paymentAmount = pricePerMinute * BigInt(durationMin)
        setTotalAmount(paymentAmount)

        const tokenAddr = paymentToken ?? '0x0000000000000000000000000000000000000000'
        try {
          const decimals = await getTokenDecimals(tokenAddr as `0x${string}`)
          const symbol = await getTokenSymbol(tokenAddr as `0x${string}`)
          let denom = BigInt(1)
          for (let i = 0; i < decimals; i++) denom *= BigInt(10)
          const whole = paymentAmount / denom
          const remainder = paymentAmount % denom
          const frac = remainder.toString().padStart(decimals, '0').slice(0, 6)
          setReadableTotal(`${whole.toString()}.${frac} ${symbol}`)
        } catch (e) {
          setReadableTotal(null)
        }
      } catch (e) {
        // ignore
      }
    })()
  }, [start, end, pricePerMinute, paymentToken])

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
      // Calculate duration in minutes
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const durationMin = Math.floor((endTime - startTime) / (1000 * 60));

      // Determine payment amount from IPFS price or fallback
      let tokenAddr = paymentToken ?? '0x0000000000000000000000000000000000000000'
      let paymentAmount: bigint
      if (pricePerMinute) {
        paymentAmount = pricePerMinute * BigInt(durationMin)
      } else {
        // fallback default 1 CTC
        paymentAmount = BigInt("1000000000000000000")
      }

      // Compute readable total
      try {
        const decimals = await getTokenDecimals(tokenAddr as `0x${string}`)
        const symbol = await getTokenSymbol(tokenAddr as `0x${string}`)
  let denom = BigInt(1)
  for (let i = 0; i < decimals; i++) denom *= BigInt(10)
  const whole = paymentAmount / denom
        const remainder = paymentAmount % denom
        const frac = remainder.toString().padStart(decimals, '0').slice(0, 6) // 6 digits precision
        setReadableTotal(`${whole.toString()}.${frac} ${symbol}`)
      } catch (e) {
        setReadableTotal(null)
      }

      // If ERC20 token, ensure allowance
      if (!isNativeToken(tokenAddr)) {
        const allowance = await getErc20Allowance(tokenAddr as `0x${string}`, address as `0x${string}`, CONTRACT_ADDRESSES.paymentRouter as `0x${string}`)
        if (allowance < paymentAmount) {
          // Request approval
          setMessage('Requesting token approval...')
          await approveErc20(walletClient, tokenAddr as `0x${string}`, CONTRACT_ADDRESSES.paymentRouter as `0x${string}`, paymentAmount)
          setMessage(null)
        }
      }

      // Call contract to book pass
      const timestampSec = BigInt(Math.floor(startTime / 1000))
      const txHash = await bookPass(
        walletClient,
        BigInt(nodeId),
        BigInt(satId),
        timestampSec,
        BigInt(durationMin),
        tokenAddr as `0x${string}`,
        paymentAmount
      );

      setMessage(`Pass booking transaction submitted! Hash: ${txHash ?? hash}`);

      // Add provisional booking to app state
      let newBooking: any = undefined
      try {
        newBooking = addBooking({
          nodeId: nodeId,
          satId: satId as string,
          start: start ? new Date(start).getTime() : Date.now(),
          end: end ? new Date(end).getTime() : Date.now() + durationMin * 60 * 1000,
          payment: { token: tokenAddr ?? 'CTC', amount: paymentAmount.toString() },
          tleSnapshotHash: undefined,
        });

        updateBooking?.(newBooking.id, { status: 'pending' as const });
      } catch (e) {
        // ignore
      }

      // Reconcile provisional booking with on-chain pass (attempt)
      try {
        if (typeof refreshData === 'function') {
          const fresh = await refreshData();
          if (newBooking && Array.isArray(fresh)) {
            // Find a matching pass by nodeId, satId and close start timestamp
            const match = fresh.find((p: any) => p.nodeId === newBooking.nodeId && p.satId === newBooking.satId && Math.abs(p.start - newBooking.start) < 120);
            if (match) {
              updateBooking?.(newBooking.id, { status: match.status, passId: match.id });
            }
          }
        }
      } catch (re) {
        // ignore reconciliation errors
      }

      // Close the modal after a short delay
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

        {totalAmount && (
          <div className="mb-3 text-sm text-foreground/70">Total: {totalAmount.toString()} (lowest unit)</div>
        )}

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
