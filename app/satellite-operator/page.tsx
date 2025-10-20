"use client"

import SatelliteForm from "@/components/satellite-form";

export default function SatelliteOperatorPage() {
  return (
    <main className="container max-w-4xl py-16">
      <h1 className="text-3xl font-bold mb-4">Satellite Operator</h1>
      <p className="text-foreground/60 mb-6">Register and manage your satellites. Provide TLE lines and optional metadata stored on IPFS.</p>

      <SatelliteForm />
    </main>
  );
}
