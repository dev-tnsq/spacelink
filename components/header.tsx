import Link from "next/link"
import { MobileMenu } from "./mobile-menu"
// Wallet connect (client component)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import WalletButton from "./wallet-button"

export const Header = () => {
  return (
    <div className="fixed z-50 top-0 left-0 w-full">
      {/* Backdrop blur overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-transparent backdrop-blur-md border-b border-foreground/5" />
      
      <header className="relative flex items-center justify-between container pt-4 md:pt-6 pb-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/spacelink-logo.jpg" alt="SpaceLink logo" className="h-8 w-auto" />
          <span className="font-mono uppercase tracking-widest text-foreground">SpaceLink</span>
        </Link>

        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-8">
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="/satellite-operator"
          >
            Satellite Operator
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="/node-operator/register"
          >
            Node Operator
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="/marketplace"
          >
            Marketplace
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="#docs"
          >
            Docs
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Wallet connect button */}
          {/* @ts-ignore - client component */}
          <WalletButton />
          {/* no CTA here — simplified header */}
        </div>
        <MobileMenu />
      </header>
    </div>
  )
}
