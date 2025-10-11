import Link from "next/link"
import { MobileMenu } from "./mobile-menu"

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
            href="#marketplace"
          >
            Marketplace
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="#register-satellite"
          >
            Register Satellite
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="#register-node"
          >
            Register Node
          </Link>
          <Link
            className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
            href="#docs"
          >
            Docs
          </Link>
        </nav>

        <Link
          className="uppercase max-lg:hidden transition-colors ease-out duration-150 font-mono text-primary hover:text-primary/80"
          href="/#launch"
        >
          Launch App
        </Link>
        <MobileMenu />
      </header>
    </div>
  )
}
