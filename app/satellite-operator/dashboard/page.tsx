"use client"

import { useMemo, useState } from "react";
import { useAppData } from "@/components/context/AppDataContext";
import { useWallet } from "@/components/context/WalletContext";
import { useConfirmPass, useCancelPass, useUpdateSatellite, useDeactivateSatellite } from "@/lib/hooks";
import CesiumGlobe from "@/components/cesium-globe";
import WalletButton from '@/components/wallet-button';

export default function SatelliteDashboardPage() {
  const { satellites, bookings } = useAppData();
  const { address, connect, isOnPreferredChain, switchToPreferredChain } = useWallet();

  const mySats = useMemo(() => satellites.filter((s) => (address ? s.owner === address : s.owner === null)), [satellites, address]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedSat = satellites.find((s) => s.id === selectedId) ?? null;

  const short = (a?: string | null) => (a ? a.slice(0, 6) + "..." + a.slice(-4) : "");

  return (
  <div style={{ marginLeft: 224 }} className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1 text-slate-100">Satellites</h1>
        <p className="text-sm text-slate-300">Overview of your satellite stations — globe-first interface</p>
      </div>

      {/* top area: left info card + right globe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-1">
          <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-6 h-[420px] text-slate-200">
            <div className="text-lg font-medium mb-2">Stations</div>
            <div className="text-sm text-slate-400 mb-6">{satellites.length}/{satellites.length} active</div>

            <div className="flex flex-col gap-3">
              <div className="flex-1 bg-[#1f2229] p-3 rounded-md h-full overflow-auto">
                <div className="text-sm text-slate-300 mb-2">Stations</div>
                <div className="text-xs text-slate-400">Quick view of your registered satellites. Click one on the globe to inspect details here.</div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => window.location.href = '/satellite-operator/dashboard'} className="flex-1 py-2 rounded-md bg-[#303449] text-slate-100">Register</button>
                <div className="">
                  <WalletButton />
                </div>
                {!address ? null : (
                  !isOnPreferredChain && (
                    <button onClick={switchToPreferredChain} className="py-2 px-3 rounded-md bg-amber-600 text-white">Switch</button>
                  )
                )}
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
                dataMode="satellites"
                globeOptions={{ ionToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN, useWorldImagery: true, useWorldTerrain: true }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* table below */}
      <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-4">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-slate-200">
            <thead className="text-slate-300 text-sm">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Cost per MB</th>
                <th className="py-3 px-4">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {satellites.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-slate-400">No satellites registered yet.</td>
                </tr>
              )}
              {satellites.map((s) => {
                const freq = (s as any).downlinkMHz ?? '—';
                const cost = (s as any).costPerMB ?? '—';
                return (
                <tr key={s.id} className="border-t border-[#2b2f3a]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block w-3 h-3 rounded-sm ${s.active ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <div>{s.name ?? s.id}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{freq}</td>
                  <td className="py-3 px-4">{typeof cost === 'number' ? cost.toFixed(2) : cost}</td>
                  <td className="py-3 px-4 text-right">…</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
        {/* bookings inline */}
        <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-4 mt-4">
          <div className="text-sm text-slate-200 font-medium mb-2">My Passes</div>
          <div className="space-y-3">
            <SatellitePassesList satellites={satellites} />
          </div>
        </div>
    </div>
  );
}

  function SatellitePassesList({ satellites }: { satellites: any[] }) {
    const { bookings } = useAppData() as any;
    const { address } = useWallet();
    const { confirmPass, isPending: isConfirming } = useConfirmPass();
    const { cancelPass, isPending: isCancelling } = useCancelPass();

    // Filter passes to show only those for this satellite operator's satellites
    const mySatIds = satellites.filter((s: any) => s.owner === address).map((s: any) => s.id);
    const myPasses = bookings.filter((p: any) => mySatIds.includes(p.satId));

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

    async function handleConfirm(passId: string) {
      try {
        await confirmPass(BigInt(passId));
      } catch (error) {
        console.error('Failed to confirm pass:', error);
      }
    }

    async function handleCancel(passId: string) {
      try {
        await cancelPass(BigInt(passId));
      } catch (error) {
        console.error('Failed to cancel pass:', error);
      }
    }

    if (!myPasses || myPasses.length === 0) return <div className="text-slate-400">No passes yet.</div>;
    return (
      <div className="space-y-2">
        {myPasses.map((pass: any) => (
          <div key={pass.id} className="flex items-center justify-between bg-[#1f2229] p-3 rounded">
            <div>
              <div className="text-sm text-slate-200">Pass #{pass.id}</div>
              <div className="text-xs text-slate-400">Node: {pass.nodeId} • Duration: {pass.durationMin} min</div>
              <div className="text-xs text-slate-400">Payment: {pass.payment?.amount || 'N/A'} CTC</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded text-sm ${getStatusColor(pass.state)}`}>
                {getStatusText(pass.state)}
              </div>
              {pass.state === 0 && ( // Show confirm/cancel buttons only for booked passes
                <>
                  <button
                    onClick={() => handleConfirm(pass.id)}
                    disabled={isConfirming}
                    className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                  >
                    {isConfirming ? 'Confirming...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => handleCancel(pass.id)}
                    disabled={isCancelling}
                    className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
