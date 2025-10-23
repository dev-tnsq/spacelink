"use client"

import React, { useState } from "react";
import { useAppData } from "./context/AppDataContext";
import { useWallet } from "./context/WalletContext";
import { useRegisterSatellite } from "@/lib/hooks";
import WalletButton from './wallet-button';
import { uploadJsonToIpfs } from '@/lib/ipfs';

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
  const [priceCtc, setPriceCtc] = useState<string>("1");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null as any);
  const [showJsonInfoModal, setShowJsonInfoModal] = useState(false);
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
      // Prepare metadata JSON and upload to IPFS if no CID provided
      let finalCid = ipfsCID;
      if (!finalCid || finalCid.trim().length === 0) {
        const metadata: any = {
          name,
          norad,
          tle1,
          tle2,
          downlinkMHz,
          dataRateMbps,
          contact,
          createdAt: new Date().toISOString(),
        };
        if (priceCtc && priceCtc.trim().length > 0) {
          try {
            const parts = priceCtc.trim().split('.')
            const whole = parts[0] || '0'
            const frac = parts[1] || ''
            const fracPadded = (frac + '000000000000000000').slice(0, 18)
            const wei = BigInt(whole) * BigInt(10 ** 18) + BigInt(fracPadded)
            metadata.pricePerMinute = wei.toString()
          } catch (e) {
            // ignore
          }
        }
        try {
          const cid = await uploadJsonToIpfs(metadata)
          finalCid = cid
          setMessage(`Uploaded metadata to IPFS: ${cid}`)
        } catch (err: any) {
          setMessage('Failed to upload metadata to IPFS: ' + (err?.message || String(err)))
          setLoading(false)
          return
        }
      }

      const hash = await registerSatellite(
        walletClient,
        tle1,
        tle2,
        finalCid || "QmDefaultSatelliteMetadata",
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

      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-foreground/60">Metadata JSON</label>
        <button type="button" onClick={() => setShowJsonInfoModal(true)} className="text-foreground/50 hover:text-foreground/70">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
        </button>
        <div className="text-xs text-foreground/50">Drag & drop a metadata JSON file or choose a file to auto-upload to IPFS. Uploaded CID will be used when registering.</div>
      </div>

      <div
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            setMessage('Please upload a .json file');
            return;
          }
          (async () => {
            try {
              setUploadingFile(true);
              setMessage(null);
              const text = await file.text();
              const json = JSON.parse(text);
              setFilePreview(JSON.stringify(json, null, 2).slice(0, 400));
              // Merge operator-set price into JSON if provided
              if (priceCtc && priceCtc.trim().length > 0) {
                try {
                  const parts = priceCtc.trim().split('.')
                  const whole = parts[0] || '0'
                  const frac = parts[1] || ''
                  const fracPadded = (frac + '000000000000000000').slice(0, 18)
                  const wei = BigInt(whole) * BigInt(10 ** 18) + BigInt(fracPadded)
                  json.pricePerMinute = wei.toString()
                } catch (e) {
                  // ignore
                }
              }
              const cid = await uploadJsonToIpfs(json);
              setIpfsCID(cid);
              setUploadedFileName(file.name);
              setMessage(`Uploaded metadata to IPFS: ${cid}`);
            } catch (err: any) {
              setMessage('Failed to upload file: ' + (err?.message || String(err)));
            } finally {
              setUploadingFile(false);
            }
          })();
        }}
        onDragOver={(e) => e.preventDefault()}
        className="mt-2 mb-3 p-3 border-dashed border-2 rounded-md border-foreground/10 text-sm text-foreground/50"
      >
        <div className="flex items-center justify-between">
          <div>Drop a satellite metadata JSON here, or</div>
          <div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-background border rounded-md text-sm">Choose File</button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return; try {
            setUploadingFile(true); setMessage(null);
            const text = await file.text(); const json = JSON.parse(text);
            setFilePreview(JSON.stringify(json, null, 2).slice(0,400)); const cid = await uploadJsonToIpfs(json);
            setIpfsCID(cid); setUploadedFileName(file.name); setMessage(`Uploaded metadata to IPFS: ${cid}`);
          } catch (err: any) {
            setMessage('Failed to upload file: ' + (err?.message || String(err)));
          } finally { setUploadingFile(false); }
        }} className="hidden" />

        <div className="mt-2 text-xs text-foreground/50">{uploadingFile ? 'Uploading file...' : uploadedFileName ? `Selected: ${uploadedFileName}` : 'No file selected'}</div>

        {filePreview && (
          <pre className="mt-2 p-2 bg-background/5 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">{filePreview}</pre>
        )}
      </div>

      {ipfsCID && (
        <div className="text-xs text-foreground/60 mb-3">Uploaded CID: <a className="text-primary" href={`https://ipfs.io/ipfs/${ipfsCID}`} target="_blank" rel="noreferrer">{ipfsCID}</a></div>
      )}

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
            setPriceCtc("1");
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
              href={`https://creditcoin-testnet.blockscout.com/tx/${txHash}`}
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
    {/* Metadata JSON format info modal */}
    {showJsonInfoModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border border-foreground/20 rounded-lg p-6 max-w-2xl w-full mx-4">
          <h3 className="text-lg font-semibold mb-3 text-foreground">Satellite metadata JSON format</h3>
          <p className="text-sm text-foreground/70 mb-3">Provide a JSON object with the fields below. Example (satellite):</p>
          <pre className="text-xs p-3 bg-foreground/5 rounded mb-3 overflow-auto">{
            `{
  "name": "DemoSat-1",
  "norad": "25544",
  "tle1": "1 25544U 98067A   21275.51782528  .00016717  00000-0  10270-3 0  9005",
  "tle2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.48919078309904",
  "downlinkMHz": "137.5",
  "dataRateMbps": "1.2",
  "contact": "operator@example.com",
  "createdAt": "2025-10-23T12:00:00Z"
}`}
          </pre>
          <div className="flex gap-3">
            <button onClick={() => setShowJsonInfoModal(false)} className="ml-auto px-4 py-2 bg-primary text-white rounded-md">Close</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
