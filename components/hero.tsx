"use client"

import Link from "next/link"
import { Pill } from "./pill"
import { Button } from "./ui/button"

export function Hero() {
  return (
    <div className="relative z-10 flex flex-col h-svh justify-center items-center">
      {/* Content */}
      <div className="text-center container max-w-4xl px-4">
        <Pill className="mb-5 font-mono tracking-widest uppercase text-xs">
          DePIN • Creditcoin
        </Pill>

        <h1 className="text-balance font-sans font-bold tracking-tight leading-tight drop-shadow-2xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-3 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          SpaceLink
        </h1>

        <h2 className="text-balance font-sans font-normal text-base sm:text-lg md:text-xl text-foreground/70 mb-8 leading-relaxed max-w-2xl mx-auto">
          Decentralized ground station network
        </h2>

        <p className="text-pretty font-sans text-sm text-foreground/60 max-w-xl mx-auto leading-relaxed mb-10">
          Satellite operators register their satellites. Ground station owners register their antennas. 
          The marketplace connects them for relay passes. Pay per use with CTC.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          <Link href="/#marketplace" className="contents">
            <Button className="px-7 py-3 text-sm shadow-lg hover:shadow-primary/30 transition-all w-full sm:w-auto">
              Browse Marketplace
            </Button>
          </Link>
          <Link href="/#register" className="contents">
            <Button
              variant="outline"
              className="px-7 py-3 text-sm border-foreground/30 text-foreground/70 hover:text-foreground hover:border-primary/50 bg-background/20 backdrop-blur-sm w-full sm:w-auto transition-all"
            >
              Register Node
            </Button>
          </Link>
        </div>
        
        <div className="text-xs text-foreground/40 mb-12">
          or <Link href="/#register-satellite" className="underline hover:text-primary">register your satellite</Link>
        </div>

        {/* Scroll indicator */}
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <p className="text-xs text-foreground/40 uppercase tracking-wider font-mono">Scroll to explore</p>
          <svg 
            className="w-5 h-5 text-foreground/40" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </div>
    </div>
  )
}
