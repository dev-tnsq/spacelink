"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function Features() {
  const { ref, isVisible } = useScrollAnimation()
  
  const features = [
    {
      title: "Global Network",
      description: "Community-owned ground stations across Asia and beyond provide reliable satellite coverage where traditional infrastructure falls short."
    },
    {
      title: "Lower Costs",
      description: "Pay around 100 CTC per pass instead of thousands of dollars charged by centralized providers."
    },
    {
      title: "Cross-Chain Payments",
      description: "Universal Smart Contracts handle transactions across different blockchains without the need for traditional bridges."
    },
    {
      title: "Automated Tracking",
      description: "Our system uses TLE orbital data to automatically match satellites with the best available ground stations."
    },
    {
      title: "Credit Building",
      description: "Every relay you complete adds to your on-chain credit score, making it easier to access financing for equipment upgrades."
    },
    {
      title: "Verified Relays",
      description: "SpaceLink verifies relays on-chain using TLE checks plus an optimistic 24-hour dispute window; Walrus stores relay records permanently and tamper-proof."
    }
  ]

  return (
    <section id="features" ref={ref} className="relative z-10 py-20 md:py-28">
      <div className="container max-w-7xl">
        <div className={`text-center mb-14 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-foreground">
            Why SpaceLink
          </h2>
          <p className="text-base text-foreground/60 max-w-2xl mx-auto">
            Built for accessibility and designed to work at scale
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`bg-background/40 backdrop-blur-sm border border-foreground/10 rounded-lg p-6 hover:border-primary/50 transition-all ${
                isVisible ? 'animate-fade-in-up' : 'opacity-0'
              } animation-delay-${Math.min(index + 1, 5) * 100}`}
            >
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-foreground/60 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
