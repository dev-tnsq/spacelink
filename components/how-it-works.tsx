"use client"

export function HowItWorks() {
  const forOperators = [
    {
      number: "01",
      title: "Register Satellite",
      description: "Add your satellite's orbital parameters (TLE data) and communication requirements to the network.",
      detail: "Orbital tracking via TLE updates"
    },
    {
      number: "02",
      title: "Browse Ground Stations",
      description: "Search available nodes by location, equipment specs, and predicted pass windows.",
      detail: "Global coverage, 5-10 min passes"
    },
    {
      number: "03",
      title: "Book & Pay",
      description: "Reserve relay passes and pay with CTC or cross-chain via Universal Smart Contracts.",
      detail: "~1 CTC per pass"
    }
  ]

  const forNodes = [
    {
      number: "01",
      title: "Register Node",
      description: "Add your ground station antenna with GNSS coordinates and hardware capabilities.",
      detail: "$200-500 hardware entry point"
    },
    {
      number: "02",
      title: "Get Booked",
      description: "Satellite operators find and book your station based on orbital predictions.",
      detail: "Automated matching system"
    },
    {
      number: "03",
      title: "Relay & Earn",
      description: "Complete the data relay, generate proof, and receive payment plus credit points.",
      detail: "1 CTC + 10 credit points"
    }
  ]

  return (
    <section id="how-it-works" className="relative z-10 py-20 md:py-28 bg-gradient-to-b from-transparent via-background/50 to-transparent">
      <div className="container max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-foreground">
            How It Works
          </h2>
          <p className="text-base text-foreground/60 max-w-2xl mx-auto">
            Two-sided marketplace for satellite operators and ground station owners
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-12">
          {/* For Satellite Operators */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
              For Satellite Operators
            </h3>
            <div className="space-y-6">
              {forOperators.map((step, index) => (
                <div key={index} className="relative bg-background/40 backdrop-blur-sm border border-foreground/10 rounded-lg p-5">
                  <div className="flex gap-4">
                    <span className="text-4xl font-bold text-primary/30 shrink-0">
                      {step.number}
                    </span>
                    <div className="space-y-2">
                      <h4 className="text-base font-semibold text-foreground">
                        {step.title}
                      </h4>
                      <p className="text-foreground/60 leading-relaxed text-sm">
                        {step.description}
                      </p>
                      <p className="text-xs font-mono text-primary/70 bg-primary/10 rounded px-3 py-1.5 inline-block">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* For Ground Station Owners */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
              For Ground Station Owners
            </h3>
            <div className="space-y-6">
              {forNodes.map((step, index) => (
                <div key={index} className="relative bg-background/40 backdrop-blur-sm border border-foreground/10 rounded-lg p-5">
                  <div className="flex gap-4">
                    <span className="text-4xl font-bold text-primary/30 shrink-0">
                      {step.number}
                    </span>
                    <div className="space-y-2">
                      <h4 className="text-base font-semibold text-foreground">
                        {step.title}
                      </h4>
                      <p className="text-foreground/60 leading-relaxed text-sm">
                        {step.description}
                      </p>
                      <p className="text-xs font-mono text-primary/70 bg-primary/10 rounded px-3 py-1.5 inline-block">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center bg-background/60 backdrop-blur-md border border-foreground/10 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-foreground mb-2">The Marketplace</h4>
          <p className="text-sm text-foreground/60 mb-4 max-w-2xl mx-auto">
            Connects registered satellites with available ground stations using orbital predictions. 
            Automated matching, verified relays, and instant payment.
          </p>
          <button className="px-8 py-3 bg-primary text-background font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg">
            Explore Marketplace
          </button>
        </div>
      </div>
    </section>
  )
}
