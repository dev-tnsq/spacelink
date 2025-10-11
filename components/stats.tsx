"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function Stats() {
  const { ref, isVisible } = useScrollAnimation()
  
  const stats = [
    {
      value: "60%",
      label: "Lower Costs",
      description: "vs. traditional providers"
    },
    {
      value: "$10-20B",
      label: "Market Size",
      description: "Annual ground segment"
    },
    {
      value: "1.4B",
      label: "People",
      description: "Without bank access"
    },
    {
      value: "10K+",
      label: "Network Goal",
      description: "Ground stations"
    },
    {
      value: "5-10min",
      label: "Pass Length",
      description: "Typical relay window"
    },
    {
      value: "1 CTC",
      label: "Per Relay",
      description: "Plus credit points"
    }
  ]

  return (
    <section id="stats" ref={ref} className="relative z-10 py-18 md:py-24">
      <div className="container max-w-7xl">
        <div className={`bg-background/60 backdrop-blur-md border border-foreground/10 rounded-xl p-8 md:p-10 ${
          isVisible ? 'animate-fade-in' : 'opacity-0'
        }`}>
          <div className="text-center mb-10">
           
            <p className="text-sm text-foreground/50">
              What makes SpaceLink different
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center ${
                  isVisible ? 'animate-fade-in-up' : 'opacity-0'
                } animation-delay-${Math.min(index + 1, 5) * 100}`}
              >
                <div className="mb-1">
                  <span className="text-3xl md:text-4xl font-bold text-primary">
                    {stat.value}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-foreground/50">
                  {stat.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
