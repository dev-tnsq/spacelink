"use client"

import ProofStatus from "@/components/proof-status";

export default function ProofCheckerPage() {
  return (
  <main className="container max-w-4xl py-16 pt-20">
      <h1 className="text-3xl font-bold mb-4">Proof Checker</h1>
      <p className="text-foreground/60 mb-6">Check the on-chain status of a relay proof. Enter the SHA-256 proof hash (or raw text), timestamp, nodeId and satId used during verification.</p>

      <ProofStatus />
    </main>
  )
}
