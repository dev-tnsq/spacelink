"use client"

import { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import { useRegisterNode } from "@/lib/hooks";
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
  const [showChainSwitchModal, setShowChainSwitchModal] = useState(false);
  const [chainSwitchError, setChainSwitchError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { addNode, refreshData } = useAppData();
  const { registerNode, isPending: contractLoading, isError, error } = useRegisterNode();
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain, walletClient } = useWallet();

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
    if (!specs || specs.trim().length === 0) {
      setMessage("Please provide hardware specs");
      return;
    }

    // UI-only: we don't require a deployed contract address to register for the demo.

    try {
      setLoading(true);

      // Ensure wallet connected
      if (!address || !walletClient) {
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

      // Call contract to register node
      const stakeAmount = BigInt("1000000000000000000"); // 1 CTC in wei (placeholder - should get from contract)
      const specsString = `NAME:${stationName} | ${specs} • Dish ${dishSize}m • ${polarization} • ${maxDataRate} Mbps`.slice(0, 250); // Include station name in specs
      const hash = await registerNode(
        walletClient,
        BigInt(Math.floor(scaledLat!)),
        BigInt(Math.floor(scaledLon!)),
        specsString,
        BigInt(Math.floor(uptime)),
        ipfsCID || "QmDefaultNodeMetadata", // Provide default IPFS CID if empty
        stakeAmount
      );

      setTxHash(hash);
      setSuccess(true);
      setShowSuccessModal(true);

      // Wait a bit for blockchain state to update, then refresh contract data
      console.log('Waiting for blockchain state to update...')
      setTimeout(async () => {
        console.log('Refreshing data after registration...')
        await refreshData();
      }, 2000);

      // Reset form fields
      setStationName("");
      setLat("");
      setLon("");
      setSpecs("");
      setDishSize("");
      setMaxDataRate("");
      setIpfsCID("");
    } catch (err: any) {
      const errorMessage = err?.message || String(err);

      // Check if it's a chain switching error
      if (errorMessage.includes('switch your wallet to Creditcoin Testnet')) {
        setChainSwitchError(errorMessage);
        setShowChainSwitchModal(true);
      } else {
        setMessage(errorMessage);
      }
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
      </div>

      {message && <p className={`mt-3 text-sm ${success ? 'text-green-400' : 'text-foreground/70'}`}>{message}</p>}

      {/* Success Modal */}
      {showSuccessModal && txHash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-green-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Registration Successful!</h3>
                <p className="text-sm text-foreground/60">Your ground station has been registered</p>
              </div>
            </div>
            
            <div className="mb-4 p-3 bg-foreground/5 rounded-md">
              <p className="text-xs text-foreground/60 mb-1">Transaction Hash:</p>
              <a
                href={`https://creditcoin.blockscout.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 break-all flex items-center gap-1"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                setTxHash(null);
                window.location.href = '/node-operator/dashboard';
              }}
              className="w-full px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Chain Switch Modal */}
      {showChainSwitchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Network Switch Required</h3>
            <p className="text-sm text-foreground/70 mb-4">
              {chainSwitchError || "Please switch your wallet to Creditcoin Testnet to continue."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChainSwitchModal(false);
                  setChainSwitchError(null);
                }}
                className="flex-1 px-4 py-2 bg-foreground/10 hover:bg-foreground/20 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    console.log('Attempting to switch to chain:', preferredChainId);
                    await switchToPreferredChain();
                    console.log('Chain switch successful');
                    setShowChainSwitchModal(false);
                    setChainSwitchError(null);
                    // Try the registration again
                    setTimeout(() => onSubmit({ preventDefault: () => {} } as any), 1000);
                  } catch (err: any) {
                    console.error('Chain switch failed:', err);
                    setChainSwitchError(err?.message || `Failed to switch network: ${err?.code || 'Unknown error'}`);
                  }
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
              >
                Switch Network
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
