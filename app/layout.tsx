import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import { Geist } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { EarthBackground } from "@/components/earth-background"

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
    "SPACELINK IS A DECENTRALIZED GROUND STATION NETWORK ON CREDITCOIN, SLASHING SATELLITE RELAY COSTS. IT LINKS OPERATORS WITH GLOBAL ANTENNA OWNERS FOR RELIABLE DATA TRANSFERS. NODE OWNERS EARN CTC AND CREDIT, BRIDGING THE $200B UNBANKED GAP IN ASIA. PAY PER USE, VERIFIED BY CHAINLINK, STORED ON WALRUS.",
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
        <EarthBackground />
        <Header />
        {children}
      </body>
    </html>
  )
}
