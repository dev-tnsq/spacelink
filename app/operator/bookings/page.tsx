"use client"

import React from 'react'
import OperatorSidebar from '../../../components/operator-sidebar'
import { useAppData } from '../../../components/context/AppDataContext'

export default function BookingsPage() {
  const { bookings, updateNode, updateSatellite } = useAppData() as any;

  function setStatus(id: string, status: string) {
    // UI-only: find booking and change status locally (would be on-chain in prod)
    try {
      const b = bookings.find((x: any) => x.id === id);
      if (!b) return;
      b.status = status;
      // trigger state update by calling updateNode with no-op (hacky but works with current context)
      updateNode && updateNode(b.nodeId, {});
    } catch (e) {}
  }

  return (
    <div>
      <OperatorSidebar />
      <main style={{ marginLeft: 224 }} className="p-6">
        <h2 className="text-xl font-medium text-slate-100 mb-4">Bookings</h2>
        <div className="space-y-3">
          {bookings.length === 0 && <div className="text-slate-400">No bookings yet.</div>}
          {bookings.map((b: any) => (
            <div key={b.id} className="bg-[#232534] p-4 rounded shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-200">Booking {b.id}</div>
                <div className="text-xs text-slate-400">Node: {b.nodeId} • Satellite: {b.satId}</div>
                <div className="text-xs text-slate-400">{new Date(b.start).toLocaleString()} → {new Date(b.end).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded text-sm ${b.status === 'confirmed' ? 'bg-green-600 text-white' : b.status === 'completed' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-black'}`}>{b.status}</div>
                <button onClick={() => setStatus(b.id, 'confirmed')} className="px-3 py-1 rounded bg-slate-700 text-white">Confirm</button>
                <button onClick={() => setStatus(b.id, 'cancelled')} className="px-3 py-1 rounded bg-red-700 text-white">Cancel</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
