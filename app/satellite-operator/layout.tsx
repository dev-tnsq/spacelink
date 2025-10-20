import type React from "react";
import OperatorSidebar from "@/components/operator-sidebar";
import FloatingNav from "@/components/floating-nav";

export default function SatelliteOperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-20">
      <FloatingNav items={[{ name: 'Satellites', link: '/satellite-operator/dashboard' }, { name: 'Nodes', link: '/node-operator/dashboard' }, { name: 'Marketplace', link: '/marketplace' }, { name: 'Home', link: '/' }]} />
      <div className="container mx-auto flex gap-6">
        <OperatorSidebar base="/satellite-operator" title="Satellite Operator" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
