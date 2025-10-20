"use client"

import { useState } from "react";
import CesiumGlobe from "@/components/cesium-globe";
import MarketplaceSidebar from "@/components/marketplace-sidebar";
import { useAppData } from "@/components/context/AppDataContext";
import { useWallet } from "@/components/context/WalletContext";
import BookModal from "@/components/book-modal";
import FloatingNav from "@/components/floating-nav";

const MARKETPLACE_ABI = [
  "function nodeCount() view returns (uint256)",
  "function satelliteCount() view returns (uint256)",
  "function getNode(uint256) view returns (tuple(address owner,int256 lat,int256 lon,string specs,bool active,uint256 uptime,string ipfsCID,uint256 stakeAmount,uint256 totalRelays))",
  "function getSatellite(uint256) view returns (tuple(address owner,string tle1,string tle2,bool active,uint256 lastUpdate,string ipfsCID))"
];

export default function MarketplacePage() {
  const { nodes, satellites } = useAppData();
  const [selected, setSelected] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [comingSoonMessage, setComingSoonMessage] = useState<string | null>(null);
  const { address, connect, isOnPreferredChain, preferredChainId, switchToPreferredChain } = useWallet();

  function short(a?: string | null) {
    if (!a) return "";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  return (
  <main className="relative min-h-screen pt-20 w-screen">
      <FloatingNav />
      {/* Fullscreen globe (background) */}
      <div className="absolute inset-0 z-0">
  <CesiumGlobe onSelect={(id) => setSelected(id)} />
      </div>

      {/* Floating UI overlay */}
      <div className="relative z-10 pointer-events-none">
        <div className="absolute left-6 top-20 pointer-events-auto">
          <MarketplaceSidebar nodes={nodes} satellites={satellites} onSelectNode={(id) => setSelected(id)} onSelectSat={(id) => setSelected(id)} />
        </div>

        <div className="absolute right-6 top-20 w-[360px] pointer-events-auto">
          <div className="bg-background/40 border border-foreground/10 p-4 rounded-lg shadow-lg">
            {!address ? (
              <div className="mb-3 flex items-center gap-3">
                <div className="text-sm text-foreground/60">Connect your wallet to book relays.</div>
                <button onClick={connect} className="px-3 py-1 bg-primary text-white rounded text-sm">Connect Wallet</button>
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-3">
                <div className="text-sm text-foreground/60">Connected: <span className="font-mono">{short(address)}</span></div>
                {!isOnPreferredChain && preferredChainId ? (
                  <button onClick={switchToPreferredChain} className="px-2 py-1 bg-accent text-background rounded-md text-xs">Switch to Creditcoin</button>
                ) : null}
              </div>
            )}
            {selected ? (
              <div>
                <h3 className="font-semibold">Details</h3>
                <pre className="text-xs mt-2">{JSON.stringify((nodes.find((n:any) => n.id === selected) || satellites.find((s:any) => s.id === selected)), null, 2)}</pre>
                <div className="mt-3">
                  {nodes.find((n:any) => n.id === selected) ? (
                    <div className="flex gap-3">
                      <button onClick={() => setComingSoonMessage("Book Relay Pass - Coming soon...")} className="px-3 py-2 bg-primary text-white rounded text-sm">Book Relay Pass</button>
                      <button onClick={() => setComingSoonMessage("Request More Info - Coming soon...")} className="px-3 py-2 bg-background border rounded text-sm">Request More Info</button>
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/60">Select a ground station to book a pass. To schedule a pass you must select one of your satellites in the booking modal.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm">Select a node or satellite on the globe or from the list to see details.</div>
            )}
            {comingSoonMessage && (
              <div className="mt-3 p-2 bg-accent/20 border border-accent/30 rounded text-sm text-accent">
                {comingSoonMessage}
              </div>
            )}
          </div>
        </div>
      </div>
      <BookModal open={bookingOpen} onClose={() => setBookingOpen(false)} nodeId={selected && nodes.find((n:any) => n.id === selected) ? selected : null} />
    </main>
  )
}
