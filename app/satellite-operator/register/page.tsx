"use client";

import SatelliteForm from '@/components/satellite-form';

export default function RegisterSatellitePage() {
  return (
    <div style={{ marginLeft: 224 }} className="p-8">
  <h1 className="text-3xl font-semibold text-slate-100 mb-4">Register Satellite</h1>
      <div className="max-w-3xl">
        <SatelliteForm />
      </div>
    </div>
  );
}
