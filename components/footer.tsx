"use client"

import Link from "next/link"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function Footer() {
  const { ref, isVisible } = useScrollAnimation()
  const currentYear = new Date().getFullYear()

  const links = {
    product: [
      { name: "Marketplace", href: "#marketplace" },
      { name: "Network", href: "#network" },
      { name: "Documentation", href: "#docs" },
      { name: "Whitepaper", href: "#whitepaper" }
    ],
    resources: [
      { name: "GitHub", href: "https://github.com/dev-tnsq/spacelink" },
      { name: "Creditcoin Docs", href: "https://creditcoin.org" },
      { name: "API Reference", href: "#api" },
      { name: "Community", href: "#community" }
    ],
    company: [
      { name: "About", href: "#about" },
      { name: "Blog", href: "#blog" },
      { name: "Careers", href: "#careers" },
      { name: "Contact", href: "#contact" }
    ]
  }

  return (
    <>
      {/* CTA Section */}
      <section ref={ref} className="relative z-10 py-20 md:py-28">
        <div className="container max-w-5xl">
          <div className={`bg-gradient-to-br from-primary/20 via-background/80 to-background/60 backdrop-blur-md border border-primary/30 rounded-xl p-8 md:p-12 text-center ${
            isVisible ? 'animate-fade-in-up' : 'opacity-0'
          }`}>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-foreground">
              Get Started with SpaceLink
            </h2>
            <p className="text-base text-foreground/60 mb-8 max-w-2xl mx-auto">
              Whether you operate satellites or own ground station equipment, we make it easier to connect and transact.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button className="px-8 py-3 bg-primary text-background font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg w-full sm:w-auto">
                Launch Marketplace
              </button>
              <button className="px-8 py-3 bg-transparent border-2 border-foreground/30 text-foreground font-medium rounded-lg hover:border-primary/50 hover:bg-background/40 transition-colors w-full sm:w-auto">
                Register Your Node
              </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-foreground/10">
              <p className="text-xs text-foreground/50 mb-3">Built for Moonshot Universe Hackathon 2025</p>
              <div className="flex justify-center gap-3 flex-wrap text-xs font-mono text-foreground/40">
                <span>Space & DePIN Track</span>
                <span>•</span>
                <span>Asia-Pacific Region</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-foreground/10 bg-background/80 backdrop-blur-sm">
        <div className="container max-w-7xl py-12 md:py-16">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/brand/spacelink-logo.jpg" alt="SpaceLink" className="h-8 w-auto" />
                <span className="font-mono uppercase tracking-widest text-foreground">SpaceLink</span>
              </div>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Decentralizing satellite communication through blockchain-powered ground station networks.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 uppercase tracking-wider text-sm">Product</h4>
              <ul className="space-y-2">
                {links.product.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-sm text-foreground/60 hover:text-primary transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4 uppercase tracking-wider text-sm">Resources</h4>
              <ul className="space-y-2">
                {links.resources.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-sm text-foreground/60 hover:text-primary transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4 uppercase tracking-wider text-sm">Company</h4>
              <ul className="space-y-2">
                {links.company.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-sm text-foreground/60 hover:text-primary transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-foreground/50">
              © {currentYear} SpaceLink. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-foreground/50">
              <Link href="#privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="#terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="#cookies" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
