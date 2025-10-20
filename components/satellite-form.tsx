"use client"

import { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import WalletButton from './wallet-button';

const MARKETPLACE_ABI = [
  "function STAKE_AMOUNT() view returns (uint256)",
  "function registerSatellite(string,string,string) payable",
  "function satelliteCount() view returns (uint256)"
];

export default function SatelliteForm({ marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "" }: { marketplaceAddress?: string }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [norad, setNorad] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [operationStatus, setOperationStatus] = useState("active");
  const [tle1, setTle1] = useState("");
  const [tle2, setTle2] = useState("");
  const [downlinkMHz, setDownlinkMHz] = useState("");
  const [dataRateMbps, setDataRateMbps] = useState("");
  const [contact, setContact] = useState("");
  const [ipfsCID, setIpfsCID] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { addSatellite } = useAppData();
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain } = useWallet();

  function quickValidateTLE(l1: string, l2: string) {
    if (!l1 || !l2) return false;
    if (l1.length < 65 || l1.length > 72) return false;
    if (l2.length < 65 || l2.length > 72) return false;
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) return false;
    // satellite numbers match
    if (l1.slice(2, 7) !== l2.slice(2, 7)) return false;
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Basic required fields
    if (!name) {
      setMessage("Please provide a satellite name");
      return;
    }

    // Require either a NORAD ID or TLE
    if (!norad && (!tle1 || !tle2)) {
      setMessage("Provide either a NORAD ID or valid TLE lines");
      return;
    }

    if (tle1 || tle2) {
      if (!quickValidateTLE(tle1, tle2)) {
        setMessage("TLE format looks invalid. Please check.");
        return;
      }
    }

    // For the UI-only flow we don't require a contract address; registration is stored in local app state.

    try {
      setLoading(true);
      setSuccess(false);

      // Ensure wallet connected
      if (!address) {
        setMessage("Please connect your wallet to register the satellite.");
        setLoading(false);
        return;
      }

      // If a preferred chain is configured and user is on a different chain, ask to switch
      if (preferredChainId && !isOnPreferredChain) {
        setMessage("Please switch your wallet to the Creditcoin network before registering.");
        setLoading(false);
        return;
      }

      // Simulate network latency / tx and then register in local in-memory store
      await new Promise((r) => setTimeout(r, 900));
  const sat = addSatellite({ tle1, tle2, ipfsCID, name });
  setMessage(`Satellite registered: ${sat.id}`);
  setSuccess(true);
      // clear a few fields for convenience
      setTle1("");
      setTle2("");
      setName("");
    } catch (err: any) {
      setMessage(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
  <form onSubmit={onSubmit} className="p-0 max-w-3xl" role="form" aria-label="Register satellite">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="text-sm text-foreground/60" htmlFor="satName">Satellite Name</label>
          <input id="satName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., DemoSat-1" className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
        </div>
        <div>
          <label className="text-sm text-foreground/60">Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g., US" className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
        </div>
        <div>
          <label className="text-sm text-foreground/60">NORAD ID</label>
          <input value={norad} onChange={(e) => setNorad(e.target.value)} placeholder="Optional" className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
          <div className="text-xs text-foreground/50">Optional — provide the NORAD catalog number if available; otherwise include TLE lines below.</div>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Launch Date</label>
          <input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
        </div>
      </div>

  <label className="text-sm text-foreground/60" htmlFor="tle1">TLE Line 1</label>
  <textarea id="tle1" value={tle1} onChange={(e) => setTle1(e.target.value)} rows={2} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" />
  <div className="text-xs text-foreground/50 mb-2">Two-line element set used for orbit propagation — obtain from Celestrak or Space-Track. Lines typically start with '1 ' and '2 '.</div>

  <label className="text-sm text-foreground/60" htmlFor="tle2">TLE Line 2</label>
  <textarea id="tle2" value={tle2} onChange={(e) => setTle2(e.target.value)} rows={2} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="text-xs text-foreground/60">Downlink Frequency (MHz)</label>
          <input value={downlinkMHz} onChange={(e) => setDownlinkMHz(e.target.value)} placeholder="e.g., 137.5" className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
        </div>
        <div>
          <label className="text-xs text-foreground/60">Data Rate (Mbps)</label>
          <input value={dataRateMbps} onChange={(e) => setDataRateMbps(e.target.value)} placeholder="e.g., 1.2" className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" />
        </div>
      </div>

      <label className="text-xs text-foreground/60">Contact (email)</label>
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="operator@example.com" className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" />

      <label className="text-xs text-foreground/60">IPFS CID (optional)</label>
      <input value={ipfsCID} onChange={(e) => setIpfsCID(e.target.value)} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" placeholder="bafy..." />

        <div className="flex gap-3">
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{loading ? "Registering…" : "Save Satellite"}</button>
          {!address ? (
            <WalletButton />
          ) : (
            !isOnPreferredChain && preferredChainId ? (
              <button type="button" onClick={switchToPreferredChain} className="px-4 py-2 bg-amber-600 rounded-md text-white">Switch to Creditcoin</button>
            ) : null
          )}
        </div>
        <button type="button" onClick={() => {
          // fill example TLE (ISS)
          setTle1("1 25544U 98067A   21275.51782528  .00016717  00000-0  10270-3 0  9005");
          setTle2("2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.48919078309904");
          setIpfsCID("");
        }} className="px-4 py-2 bg-background border rounded-md">Use Example</button>
      </div>

      {message && <p className={`mt-3 text-sm ${success ? 'text-green-400' : 'text-foreground/70'}`}>{message}</p>}
    </form>
  );
}
