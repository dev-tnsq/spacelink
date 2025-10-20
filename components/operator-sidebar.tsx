"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./context/WalletContext";
import { Grid, Plus, Wallet } from "lucide-react";

export default function OperatorSidebar({ base = "/", title = "Operator" }: { base?: string; title?: string }) {
  const pathname = usePathname();
  const { address, connect, disconnect, chainId, preferredChainId, isOnPreferredChain, switchToPreferredChain } = useWallet();

    // Contextual operator navigation: show only node or satellite links when inside those areas
    let items: { name: string; href: string; icon: any }[] = [];
    if (pathname?.startsWith("/node-operator")) {
      items = [
        { name: "Stations", href: "/node-operator/dashboard", icon: Grid },
        { name: "Register station", href: "/node-operator/register", icon: Plus },
      ];
    } else if (pathname?.startsWith("/satellite-operator")) {
      items = [
        { name: "Satellites", href: "/satellite-operator/dashboard", icon: Grid },
        { name: "Register satellite", href: "/satellite-operator/register", icon: Plus },
      ];
    } else {
      // default global view
      items = [
        { name: "Dashboard", href: "/", icon: Grid },
        { name: "Stations", href: "/node-operator/dashboard", icon: Grid },
        { name: "Satellites", href: "/satellite-operator/dashboard", icon: Grid },
      ];
    }

  function short(a?: string | null) {
    if (!a) return "";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#2b2f3a] text-slate-200 shadow-inner z-50">
      <div className="h-full flex flex-col">
        <div className="px-4 py-6 border-b border-[#23262b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#303449] flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="text-lg font-medium">SpaceLink</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1" aria-label="operator">
          {items.map((it) => {
            const active = it.href === '/' ? pathname === '/' : !!pathname?.startsWith(it.href);
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${active ? 'bg-[#394055] text-white' : 'text-slate-300 hover:bg-[#33363d]'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-sm">{it.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-[#23262b]">
          <div className="text-xs text-slate-400 mb-2">Wallet</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1f2229] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm truncate" title={address ?? 'Not connected'}>{address ? short(address) : 'Not connected'}</div>
              <div className="text-xs text-slate-400">{address ? `Chain ${chainId ?? '-'}` : 'Connect to continue'}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
