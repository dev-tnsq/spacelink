import type React from "react";
import OperatorSidebar from "@/components/operator-sidebar";
import FloatingNav from "@/components/floating-nav";

export default function NodeOperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-20">
      <FloatingNav items={[{ name: 'Nodes', link: '/node-operator/dashboard' }, { name: 'Satellites', link: '/satellite-operator/dashboard' }, { name: 'Marketplace', link: '/marketplace' }, { name: 'Home', link: '/' }]} />
      <div className="container mx-auto flex gap-6">
        <OperatorSidebar base="/node-operator" title="Ground Station Operator" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
