"use client"

import { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import { useRegisterSatellite } from "@/lib/hooks";
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
  const [showChainSwitchModal, setShowChainSwitchModal] = useState(false);
  const [chainSwitchError, setChainSwitchError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { addSatellite, refreshData } = useAppData();
  const { registerSatellite, isPending: contractLoading, isError, error } = useRegisterSatellite();
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain, walletClient } = useWallet();

    function quickValidateTLE(l1: string, l2: string) {
    if (!l1 || !l2) return false;
    if (l1.length !== 69 || l2.length !== 69) return false;
    if (!l1.startsWith('1') || !l2.startsWith('2')) return false;
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

      const stakeAmount = BigInt("1000000000000000000"); // 1 CTC in wei

      // Call contract to register satellite
      const hash = await registerSatellite(
        walletClient,
        tle1,
        tle2,
        ipfsCID || "QmDefaultSatelliteMetadata",
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

      // Clear form fields
      setTle1("");
      setTle2("");
      setName("");
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
    <>
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
              <p className="text-sm text-foreground/60">Your satellite has been registered</p>
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
              window.location.href = '/satellite-operator/dashboard';
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
    </>
  );
}
