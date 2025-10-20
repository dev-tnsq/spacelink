"use client"

import { useState } from "react";

export default function ProofStatus() {
  const [proofHash, setProofHash] = useState<string>("");
  const [timestamp, setTimestamp] = useState<string>("");
  const [nodeId, setNodeId] = useState<string>("");
  const [satId, setSatId] = useState<string>("");
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setError(null);
    setComputedHash(null);
    if (!proofHash) {
      setError("Enter proof text or hex and click Compute");
      return;
    }

    try {
      // If the user already provided a hex string prefixed with 0x and 64 chars, just echo it
      if (/^0x[0-9a-fA-F]{64}$/.test(proofHash.trim())) {
        setComputedHash(proofHash.trim());
        return;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(proofHash);
      const digest = await crypto.subtle.digest("SHA-256", data);
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      setComputedHash("0x" + hex);
    } catch (err: any) {
      setError(String(err?.message || err));
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-background/40 border border-foreground/10 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Proof Checker (UI-only)</h3>

      <label className="text-xs text-foreground/60">Proof Hash (bytes32 or text)</label>
      <input value={proofHash} onChange={(e) => setProofHash(e.target.value)} className="w-full p-2 rounded-md mb-3 bg-background/30" placeholder="0x... or raw text" />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs text-foreground/60">Timestamp (unix)</label>
          <input value={timestamp} onChange={(e) => setTimestamp(e.target.value)} className="w-full p-2 rounded-md mb-3 bg-background/30" placeholder="1690000000" />
        </div>
        <div>
          <label className="text-xs text-foreground/60">Node ID</label>
          <input value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="w-full p-2 rounded-md mb-3 bg-background/30" placeholder="node id" />
        </div>
        <div>
          <label className="text-xs text-foreground/60">Sat ID</label>
          <input value={satId} onChange={(e) => setSatId(e.target.value)} className="w-full p-2 rounded-md mb-3 bg-background/30" placeholder="sat id" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={compute} className="px-4 py-2 bg-primary text-white rounded-md">Compute SHA-256</button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {computedHash && (
        <div className="mt-4 p-3 bg-background/20 border border-foreground/5 rounded-md">
          <strong className="block">Computed bytes32</strong>
          <p className="text-sm text-foreground/70 break-words">{computedHash}</p>
          <p className="text-xs text-foreground/50 mt-2">This is a UI-only computation. To check a proof against an on-chain oracle you will need to enable contract integration and a provider; that will be added in the integration phase.</p>
        </div>
      )}

      <p className="mt-4 text-xs text-foreground/50">Tip: enter the same fields used when calling verifyProof on the oracle contract. This tool only computes the SHA-256 used as the payload; the final on-chain proof id uses packed keccak256 of the inputs when submitting to the contract.</p>
    </div>
  );
}
