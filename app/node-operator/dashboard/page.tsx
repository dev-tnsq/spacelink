"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/components/context/AppDataContext";
import { useWallet } from "@/components/context/WalletContext";
import CesiumGlobe from "@/components/cesium-globe";
import WalletButton from '@/components/wallet-button';

export default function NodeDashboardPage() {
  const { nodes, updateNode } = useAppData();
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

          {/* bookings inline */}
          <div className="bg-[#232534] border border-[#2b2f3a] rounded-lg p-4 mt-4">
            <div className="text-sm text-slate-200 font-medium mb-2">Bookings</div>
            <div className="space-y-3">
              {/** useAppData provides bookings */}
              <BookingsList />
            </div>
          </div>
    </div>
  );
}

    function BookingsList() {
      const { bookings, updateBooking } = useAppData() as any;
      if (!bookings || bookings.length === 0) return <div className="text-slate-400">No bookings yet.</div>;
      return (
        <div className="space-y-2">
          {bookings.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between bg-[#1f2229] p-3 rounded">
              <div>
                <div className="text-sm text-slate-200">{b.id}</div>
                <div className="text-xs text-slate-400">Node: {b.nodeId} • Sat: {b.satId}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-sm ${b.status === 'confirmed' ? 'bg-green-600 text-white' : b.status === 'completed' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-black'}`}>{b.status}</div>
                <button onClick={() => updateBooking(b.id, { status: 'confirmed' })} className="px-3 py-1 rounded bg-slate-700 text-white">Confirm</button>
                <button onClick={() => updateBooking(b.id, { status: 'cancelled' })} className="px-3 py-1 rounded bg-red-700 text-white">Cancel</button>
              </div>
            </div>
          ))}
        </div>
      );
    }
