"use client"

import Link from "next/link"
import { Pill } from "./pill"
import { Button } from "./ui/button"

export function Hero() {
  return (
    <div className="relative z-10 flex flex-col h-svh justify-end">
      {/* Content */}
      <div className="pb-16 text-center container">
        <Pill className="mb-6">DePIN • CREDITCOIN</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-sentient text-balance">
          SpaceLink: Decentralized Satellite Relay
        </h1>
        <p className="font-mono text-sm sm:text-base text-foreground/70 text-pretty mt-6 max-w-[720px] mx-auto">
          A blockchain-native marketplace for satellite-to-ground data passes. Book affordable relay windows from
          community nodes with GNSS coordinates, settle trustlessly via USCs and on-chain credit, and store payloads
          immutably on Walrus.
        </p>

        <div className="mt-12 flex items-center justify-center gap-4">
          <Link href="/#join" className="contents">
            <Button>[Join the Network]</Button>
          </Link>
          <Link
            href="/#whitepaper"
            className="font-mono uppercase text-foreground/70 hover:text-foreground transition-colors ease-out duration-150"
          >
            Read Whitepaper →
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-foreground/60">
          <span className="px-3 py-1 rounded border border-[var(--color-border)]/60">Chainlink Oracles</span>
          <span className="px-3 py-1 rounded border border-[var(--color-border)]/60">
            Universal Smart Contracts (USCs)
          </span>
          <span className="px-3 py-1 rounded border border-[var(--color-border)]/60">Credal BNPL</span>
          <span className="px-3 py-1 rounded border border-[var(--color-border)]/60">On-Chain Credit</span>
          <span className="px-3 py-1 rounded border border-[var(--color-border)]/60">Walrus Storage</span>
        </div>
      </div>
    </div>
  )
}
