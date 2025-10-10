import Link from "next/link"
import { MobileMenu } from "./mobile-menu"

export const Header = () => {
  return (
    <div className="fixed z-50 pt-8 md:pt-14 top-0 left-0 w-full">
      <header className="flex items-center justify-between container">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/spacelink-logo.jpg" alt="SpaceLink logo" className="h-8 w-auto" />
          <span className="font-mono uppercase tracking-widest text-foreground">SpaceLink</span>
        </Link>

        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10">
          {["Network", "Marketplace", "Docs", "Contact"].map((item) => (
            <Link
              className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
              href={`#${item.toLowerCase()}`}
              key={item}
            >
              {item}
            </Link>
          ))}
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
