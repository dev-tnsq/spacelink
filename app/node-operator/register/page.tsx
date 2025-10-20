"use client";

import NodeForm from '@/components/node-form';

export default function RegisterNodePage() {
  return (
    <div style={{ marginLeft: 224 }} className="p-8">
  <h1 className="text-3xl font-semibold text-slate-100 mb-4">Register Ground Station</h1>
      <div className="max-w-3xl">
        <NodeForm />
      </div>
    </div>
  );
}
