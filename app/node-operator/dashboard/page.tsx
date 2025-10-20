"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/components/context/AppDataContext";
import { useWallet } from "@/components/context/WalletContext";
import { useCompletePass } from "@/lib/hooks";
import CesiumGlobe from "@/components/cesium-globe";
import WalletButton from '@/components/wallet-button';

export default function NodeDashboardPage() {
  const { nodes, bookings } = useAppData();
  const { address, connect } = useWallet();

  const myNodes = useMemo(() => nodes.filter((n) => (address ? n.owner === address : n.owner === null)), [nodes, address]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const short = (a?: string | null) => (a ? a.slice(0, 6) + "..." + a.slice(-4) : "");

  return (
  <div style={{ marginLeft: 224 }} className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold mb-1 text-slate-100">Stations</h1>
        <p className="text-sm text-slate-300">Globe-first view — manage your ground stations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-1">
          <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-6 h-[420px] text-slate-200">
            <div className="text-lg font-medium mb-2">Stations</div>
            <div className="text-sm text-slate-400 mb-6">{nodes.length}/{nodes.length} active</div>

            <div className="flex flex-col gap-3">
              <div className="flex-1 bg-[#1f2229] p-3 rounded-md h-full overflow-auto">
                <div className="text-sm text-slate-300 mb-2">Stations</div>
                <div className="text-xs text-slate-400">Click a station on the globe to inspect details here.</div>
              </div>

              <div className="flex gap-2 items-center">
                <a href="/node-operator/register" className="text-sm text-slate-300 underline">Register a new station</a>
                <div className="ml-auto">
                  <WalletButton />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg overflow-hidden">
           
            <div className="p-3 bg-[#0b0b0d] h-[420px]">
              <CesiumGlobe
                className="w-full h-full rounded-md"
                onSelect={(id) => setSelectedId(id)}
                dataMode="nodes"
                globeOptions={{ ionToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN, useWorldImagery: true, useWorldTerrain: true, showNodeCoverage: true }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-4">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-slate-200">
            <thead className="text-slate-300 text-sm">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {nodes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-slate-400">No stations yet.</td>
                </tr>
              )}
              {nodes.map((n) => (
                <tr key={n.id} className="border-t border-[#2b2f3a]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block w-3 h-3 rounded-sm ${n.active ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <div>{n.name}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{n.lat.toFixed(3)}, {n.lon.toFixed(3)}</td>
                  <td className="py-3 px-4">{n.active ? 'Active' : 'Inactive'}</td>
                  <td className="py-3 px-4 text-right">…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

          {/* passes inline */}
          <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-4 mt-4">
            <div className="text-sm text-slate-200 font-medium mb-2">My Passes</div>
            <div className="space-y-3">
              <NodePassesList nodes={nodes} />
            </div>
          </div>
    </div>
  );
}

    function NodePassesList({ nodes }: { nodes: any[] }) {
      const { bookings } = useAppData() as any;
      const { address } = useWallet();
      const { completePass, isPending, isConfirmed } = useCompletePass();

      // Filter passes to show only those for this node's operator
      const myNodeIds = nodes.filter((n: any) => n.owner === address).map((n: any) => n.id);
      const myPasses = bookings.filter((p: any) => myNodeIds.includes(p.nodeId));

      const getStatusText = (state: number) => {
        switch (state) {
          case 0: return 'Booked';
          case 1: return 'Transferable';
          case 2: return 'Locked';
          case 3: return 'Completed';
          case 4: return 'Verified';
          case 5: return 'Settled';
          case 6: return 'Cancelled';
          default: return 'Unknown';
        }
      };

      const getStatusColor = (state: number) => {
        switch (state) {
          case 0: return 'bg-yellow-600 text-black';
          case 1: return 'bg-blue-600 text-white';
          case 2: return 'bg-orange-600 text-white';
          case 3: return 'bg-purple-600 text-white';
          case 4: return 'bg-green-600 text-white';
          case 5: return 'bg-gray-600 text-white';
          case 6: return 'bg-red-600 text-white';
          default: return 'bg-gray-500 text-white';
        }
      };

      async function handleComplete(passId: string, proofCID: string) {
        try {
          await completePass(
            BigInt(passId),
            proofCID,
            BigInt(0), // signalStrength
            BigInt(0), // dataSizeBytes
            'UHF', // band
            '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}` // tleSnapshotHash
          );
        } catch (error) {
          console.error('Failed to complete pass:', error);
        }
      }

      if (!myPasses || myPasses.length === 0) return <div className="text-slate-400">No passes yet.</div>;
      return (
        <div className="space-y-2">
          {myPasses.map((pass: any) => (
            <div key={pass.id} className="flex items-center justify-between bg-[#1f2229] p-3 rounded">
              <div>
                <div className="text-sm text-slate-200">Pass #{pass.id}</div>
                <div className="text-xs text-slate-400">Satellite: {pass.satId} • Duration: {pass.durationMin} min</div>
                <div className="text-xs text-slate-400">Payment: {pass.payment?.amount || 'N/A'} CTC</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-sm ${getStatusColor(pass.state)}`}>
                  {getStatusText(pass.state)}
                </div>
                {pass.state >= 1 && pass.state < 3 && ( // Show complete button for transferable/locked passes
                  <button
                    onClick={() => handleComplete(pass.id, pass.proofCID || 'test-proof-cid')}
                    disabled={isPending}
                    className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                  >
                    {isPending ? 'Completing...' : 'Complete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
