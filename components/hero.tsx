"use client"

import Link from "next/link"
import { Pill } from "./pill"
import { Button } from "./ui/button"

export function Hero() {
  return (
    <div className="relative z-10 flex flex-col h-svh justify-end">
      {/* Content */}
      <div className="pb-20 text-center container">
        <Pill className="mb-6 font-mono tracking-widest uppercase">DePIN • Creditcoin</Pill>

        <h1 className="text-balance font-sans font-semibold tracking-tight leading-[0.9] drop-shadow-md text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
          SpaceLink
        </h1>

        <p className="mt-4 text-pretty font-sans text-lg sm:text-xl md:text-2xl text-foreground/90 drop-shadow">
          Decentralized satellite-to-ground relay marketplace for affordable, verified passes.
        </p>

        <p className="mt-7 max-w-[860px] mx-auto font-mono text-sm sm:text-base leading-6 text-foreground/80">
          Book 5–10 minute passes from community nodes with GNSS coordinates. Settle cross-chain via Universal Smart
          Contracts, finance $200–500 kits with Credal BNPL, and build on-chain credit (+10 per relay). Execution
          verified by Chainlink, payloads stored immutably on Walrus.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/#marketplace" className="contents">
            <Button className="px-6 py-5 text-base">Launch Marketplace</Button>
          </Link>
          <Link href="/#whitepaper" className="contents">
            <Button
              variant="outline"
              className="px-6 py-5 text-base border-foreground/30 text-foreground/80 hover:text-foreground bg-transparent"
            >
              Read the Whitepaper
            </Button>
          </Link>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-foreground/70">
          <span className="px-3 py-1 rounded border border-border/60">Chainlink Oracles</span>
          <span className="px-3 py-1 rounded border border-border/60">USCs (Cross‑Chain)</span>
          <span className="px-3 py-1 rounded border border-border/60">Credal BNPL</span>
          <span className="px-3 py-1 rounded border border-border/60">On‑Chain Credit</span>
          <span className="px-3 py-1 rounded border border-border/60">Walrus Storage</span>
        </div>
      </div>
    </div>
  )
}
