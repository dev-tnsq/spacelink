"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function TechStack() {
  const { ref, isVisible } = useScrollAnimation()
  
  const technologies = [
    {
      name: "Creditcoin",
      description: "Handles on-chain credit scoring and provides the blockchain infrastructure for the entire network.",
      category: "Blockchain",
      color: "from-blue-500/20 to-cyan-500/20"
    },
    {
      name: "Chainlink",
      description: "Verifies relay proofs through decentralized oracles, ensuring data accuracy without central control.",
      category: "Oracle",
      color: "from-purple-500/20 to-pink-500/20"
    },
    {
      name: "Walrus",
      description: "Stores all network metadata and relay records permanently with content-addressed retrieval.",
      category: "Storage",
      color: "from-green-500/20 to-emerald-500/20"
    },
    {
      name: "Universal Smart Contracts",
      description: "Enables payments across different blockchains without requiring traditional bridge infrastructure.",
      category: "Cross-Chain",
      color: "from-yellow-500/20 to-orange-500/20"
    },
    {
      name: "Credal BNPL",
      description: "Provides financing options for ground station equipment, making entry more accessible.",
      category: "Finance",
      color: "from-red-500/20 to-rose-500/20"
    },
    {
      name: "TLE Processing",
      description: "Uses orbital tracking data from Celestrak to predict when satellites will be in range of ground stations.",
      category: "Data",
      color: "from-indigo-500/20 to-violet-500/20"
    }
  ]

  return (
    <section id="tech-stack" ref={ref} className="relative z-10 py-20 md:py-28">
      <div className="container max-w-7xl">
        <div className={`text-center mb-14 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-foreground">
            Technology Stack
          </h2>
          <p className="text-base text-foreground/60 max-w-2xl mx-auto">
            Built with proven infrastructure
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technologies.map((tech, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden bg-background/40 backdrop-blur-sm border border-foreground/10 rounded-lg p-6 hover:border-primary/50 transition-all hover:scale-105 ${
                isVisible ? 'animate-fade-in-up' : 'opacity-0'
              } animation-delay-${Math.min(index + 1, 5) * 100}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tech.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              
              <div className="relative z-10">
                <span className="inline-block px-3 py-1 text-xs font-mono uppercase tracking-wider bg-primary/10 text-primary rounded-full mb-3">
                  {tech.category}
                </span>
                
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {tech.name}
                </h3>
                
                <p className="text-sm text-foreground/60 leading-relaxed">
                  {tech.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-foreground/50 font-mono">
            Running on Creditcoin Testnet • Chain ID: 102031 • Solidity 0.8.20
          </p>
        </div>
      </div>
    </section>
  )
}
