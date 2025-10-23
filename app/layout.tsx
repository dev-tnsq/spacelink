import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import { Geist } from "next/font/google"
import "./globals.css"
// EarthBackground moved to the landing page only
import { WalletProvider } from "@/components/context/WalletContext"
import { AppDataProvider } from "@/components/context/AppDataContext"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "SpaceLink",
  description:
    "SpaceLink is a decentralized ground station network on Creditcoin, slashing satellite relay costs. It links operators with global antenna owners for reliable data transfers. Node owners earn CTC and credit, bridging the $200B unbanked gap in Asia. Pay per use, verified on-chain with an optimistic 24-hour dispute window, metadata stored on IPFS.",
  icons: {
    icon: "/brand/spacelink-logo.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <WalletProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
