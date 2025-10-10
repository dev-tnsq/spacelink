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
    "Decentralized satellite-to-ground relay marketplace on Creditcoin. Book affordable 5–10 minute passes from community nodes, settle via USCs and on-chain credit, verified by Chainlink, stored on Walrus.",
  generator: "v0.app",
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
