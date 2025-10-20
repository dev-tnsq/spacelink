"use client"

import React from "react";

export default function MarketplaceSidebar({ nodes = [], satellites = [], onSelectNode = () => {}, onSelectSat = () => {} }: { nodes?: any[]; satellites?: any[]; onSelectNode?: (id: string) => void; onSelectSat?: (id: string) => void }) {
  return (
    <aside className="w-80 bg-background/30 border-r border-foreground/10 p-4 overflow-y-auto">
      <h4 className="font-semibold mb-3">Stations</h4>
      <ul className="space-y-2 mb-6">
        {nodes.map((n: any) => (
          <li key={`n-${n.id}`} className="p-2 bg-background/20 rounded hover:bg-background/40 cursor-pointer" onClick={() => onSelectNode(n.id)}>
            <div className="text-sm font-medium">Node #{n.id}</div>
            <div className="text-xs text-foreground/60">{n.specs || "No specs"}</div>
            <div className="text-xs text-foreground/50">{n.lat.toFixed(4)}, {n.lon.toFixed(4)}</div>
          </li>
        ))}
        {nodes.length === 0 && <li className="text-xs text-foreground/50">No nodes registered yet</li>}
      </ul>

      <h4 className="font-semibold mb-3">Satellites</h4>
      <ul className="space-y-2">
        {satellites.map((s: any) => (
          <li key={`s-${s.id}`} className="p-2 bg-background/20 rounded hover:bg-background/40 cursor-pointer" onClick={() => onSelectSat(s.id)}>
            <div className="text-sm font-medium">Sat #{s.id}</div>
            <div className="text-xs text-foreground/60">TLE updated: {s.lastUpdate ? new Date(s.lastUpdate).toLocaleString() : '—'}</div>
            <div className="text-xs text-foreground/50">{s.ipfsCID || 'No metadata'}</div>
          </li>
        ))}
        {satellites.length === 0 && <li className="text-xs text-foreground/50">No satellites registered yet</li>}
      </ul>
    </aside>
  );
}
