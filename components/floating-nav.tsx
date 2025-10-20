"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "./context/WalletContext";

type NavItem = { name: string; link: string; icon?: React.ReactNode };

export default function FloatingNav({ items }: { items?: NavItem[] }) {
  const defaultItems: NavItem[] = [
    { name: 'Satellites', link: '/satellite-operator/dashboard' },
    { name: 'Nodes', link: '/node-operator/dashboard' },
    { name: 'Marketplace', link: '/marketplace' },
  ];
  const navItems: NavItem[] = items ?? defaultItems;
  const [visible, setVisible] = useState(true);
  const { address, connect } = useWallet();

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      setVisible(y <= lastY || y < 50);
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-transform ${visible ? 'translate-y-0' : '-translate-y-24'}`}>
      <div className="bg-white/5 dark:bg-slate-900/40 backdrop-blur rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-white/6">
        {navItems.map((it) => (
          <Link key={it.link} href={it.link} className="text-sm text-white px-3 py-1 rounded hover:bg-white/6">
            {it.icon ?? null}
            <span className="ml-1">{it.name}</span>
          </Link>
        ))}
        {!address ? (
          <button onClick={() => connect()} className="text-sm text-white px-3 py-1 rounded hover:bg-white/6 bg-primary">
            Connect Wallet
          </button>
        ) : (
          <div className="text-sm text-white px-3 py-1 rounded bg-white/6">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        )}
      </div>
    </div>
  );
}
