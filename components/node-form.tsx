"use client"

import { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import WalletButton from './wallet-button';

const MARKETPLACE_ABI = [
  "function STAKE_AMOUNT() view returns (uint256)",
  "function registerNode(int256,int256,string,uint256,string) payable",
  "function nodeCount() view returns (uint256)"
];

export default function NodeForm({ marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "" }: { marketplaceAddress?: string }) {
  const [stationName, setStationName] = useState("");
  const [stationId, setStationId] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [specs, setSpecs] = useState<string>("");
  const [dishSize, setDishSize] = useState<string>("");
  const [polarization, setPolarization] = useState<string>("RHCP");
  const [maxDataRate, setMaxDataRate] = useState<string>("");
  const [uptime, setUptime] = useState<number>(95);
  const [ipfsCID, setIpfsCID] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { addNode } = useAppData();
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain } = useWallet();

  function toScaledInt(value: string) {
    const f = parseFloat(value);
    if (isNaN(f)) return null;
    return Math.round(f * 10000);
  }

  async function fillMyLocation() {
    if (!navigator.geolocation) {
      setMessage("Geolocation API not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLon(pos.coords.longitude.toFixed(6));
      setMessage("Filled location from browser GPS");
    }, (err) => {
      setMessage("Unable to get location: " + err.message);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSuccess(false);

    const scaledLat = toScaledInt(lat);
    const scaledLon = toScaledInt(lon);
    if (!stationName) {
      setMessage("Please provide a station name");
      return;
    }
    if (scaledLat === null || scaledLon === null) {
      setMessage("Please provide valid latitude and longitude");
      return;
    }

    // UI-only: we don't require a deployed contract address to register for the demo.

    try {
      setLoading(true);

      // Ensure wallet connected
      if (!address) {
        setMessage("Please connect your wallet to register the ground station.");
        setLoading(false);
        return;
      }

      // Ensure correct chain if preferred is configured
      if (preferredChainId && !isOnPreferredChain) {
        setMessage("Please switch your wallet to the Creditcoin network before registering.");
        setLoading(false);
        return;
      }

      await new Promise((r) => setTimeout(r, 900));
      const node = addNode({ name: stationName || `Ground Station ${lat},${lon}`, lat: Number(lat), lon: Number(lon), description: ipfsCID ? `IPFS:${ipfsCID}` : undefined, specs: `${specs} • Dish ${dishSize}m • ${polarization}`, active: true });
  setMessage(`Node registered locally — id ${node.id}`);
  setSuccess(true);
      // reset some fields for convenience
  setStationName("");
  setIpfsCID("");
  // keep other fields so user can register multiple stations quickly
    } catch (err: any) {
      setMessage(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
  <form onSubmit={onSubmit} className="p-0 max-w-3xl" role="form" aria-label="Register ground station">
    {/* Heading is provided by the page — keep form chrome minimal */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm text-foreground/60" htmlFor="stationName">Station Name</label>
          <input id="stationName" value={stationName} onChange={(e) => setStationName(e.target.value)} className="w-full p-3 rounded-md mb-1 bg-transparent border border-[#2b2f3a]" placeholder="e.g., My Ground Station" />
        </div>
        <div>
          <label className="text-sm text-foreground/60">Station ID</label>
          <input value={stationId} onChange={(e) => setStationId(e.target.value)} className="w-full p-3 rounded-lg mb-1 bg-background/30 border border-foreground/5" placeholder="Optional identifier" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-foreground/60" htmlFor="lat">Latitude</label>
          <input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" placeholder="14.0583" />
        </div>
        <div>
          <label className="text-sm text-foreground/60">Longitude</label>
          <input value={lon} onChange={(e) => setLon(e.target.value)} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" placeholder="100.511" />
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <button type="button" onClick={fillMyLocation} className="px-3 py-2 bg-background border rounded-md">Use My Location</button>
        <button type="button" onClick={() => { setLat(""); setLon(""); }} className="px-3 py-2 bg-background border rounded-md">Clear</button>
      </div>

  <label className="text-sm text-foreground/60" htmlFor="specs">Hardware Specs</label>
  <input id="specs" value={specs} onChange={(e) => setSpecs(e.target.value)} className="w-full p-3 rounded-md mb-3 bg-transparent border border-[#2b2f3a]" placeholder="e.g., S-band, 100 Mbps" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-sm text-foreground/60">Dish Size (m)</label>
          <input value={dishSize} onChange={(e) => setDishSize(e.target.value)} className="w-full p-3 rounded-lg mb-1 bg-background/30 border border-foreground/5" placeholder="e.g., 2.4" />
        </div>
        <div>
          <label className="text-sm text-foreground/60">Polarization</label>
          <select value={polarization} onChange={(e) => setPolarization(e.target.value)} className="w-full p-3 rounded-lg mb-1 bg-background/30 border border-foreground/5">
            <option>RHCP</option>
            <option>LHCP</option>
            <option>Linear</option>
            <option>Other</option>
          </select>
          <div className="text-xs text-foreground/50">Typical LEO systems use RHCP/LHCP — choose the antenna polarization.</div>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Max Data Rate (Mbps)</label>
          <input value={maxDataRate} onChange={(e) => setMaxDataRate(e.target.value)} className="w-full p-3 rounded-lg mb-1 bg-background/30 border border-foreground/5" placeholder="e.g., 100" />
        </div>
      </div>

      <label className="text-sm text-foreground/60">Expected Uptime (%)</label>
      <input value={uptime} onChange={(e) => setUptime(Number(e.target.value))} type="number" min={0} max={100} className="w-full p-3 rounded-lg mb-3 bg-background/30 border border-foreground/5" />

  <label className="text-sm text-foreground/60" htmlFor="ipfs">IPFS CID (optional)</label>
  <input id="ipfs" value={ipfsCID} onChange={(e) => setIpfsCID(e.target.value)} className="w-full p-3 rounded-lg mb-3 bg-background/30 border border-foreground/5" placeholder="bafy..." />

    <div className="flex gap-3">
  <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{loading ? "Registering…" : "Save Station"}</button>
        {!address ? (
          <WalletButton />
        ) : (
          !isOnPreferredChain && preferredChainId ? (
            <button type="button" onClick={switchToPreferredChain} className="px-4 py-2 bg-amber-600 rounded-md text-white">Switch to Creditcoin</button>
          ) : null
        )}
      </div>

      {message && <p className={`mt-3 text-sm ${success ? 'text-green-400' : 'text-foreground/70'}`}>{message}</p>}
    </form>
  );
}
