"use client"

import React, { createContext, useContext, useMemo, useState } from "react";
import { useWallet } from "./WalletContext";

export type NodeRecord = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
  specs?: string;
  owner?: string | null;
  active?: boolean;
};

export type SatelliteRecord = {
  id: string;
  name?: string;
  tle1: string;
  tle2: string;
  ipfsCID?: string;
  owner?: string | null;
  lastUpdate?: number;
  active?: boolean;
};

export type BookingRecord = {
  id: string;
  nodeId: string;
  satId: string;
  requester?: string | null;
  start: number;
  end: number;
  status?: "pending" | "confirmed" | "completed" | "cancelled";
};

type AppDataValue = {
  nodes: NodeRecord[];
  satellites: SatelliteRecord[];
  bookings: BookingRecord[];
  addNode: (n: Omit<NodeRecord, "id" | "owner">) => NodeRecord;
  addSatellite: (s: Omit<SatelliteRecord, "id" | "owner" | "lastUpdate">) => SatelliteRecord;
  addBooking: (b: Omit<BookingRecord, "id" | "requester">) => BookingRecord;
  updateBooking: (id: string, patch: Partial<BookingRecord>) => void;
  updateNode: (id: string, patch: Partial<NodeRecord>) => void;
  updateSatellite: (id: string, patch: Partial<SatelliteRecord>) => void;
};

const AppDataContext = createContext<AppDataValue | undefined>(undefined);

function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const initialNodes: NodeRecord[] = [
  {
    id: randomId("node"),
    name: "Ground Station - SF",
    lat: 37.7749,
    lon: -122.4194,
    description: "Demo ground station in San Francisco",
    specs: "UHF receiver, 2m dish",
    owner: null,
    active: true,
  },
  {
    id: randomId("node"),
    name: "Ground Station - Berlin",
    lat: 52.5200,
    lon: 13.4050,
    description: "Demo ground station in Berlin",
    specs: "L-band receiver",
    owner: null,
    active: true,
  },
];

const initialSatellites: SatelliteRecord[] = [
  {
    id: randomId("sat"),
    name: "DemoSat-1",
    tle1: "1 25544U 98067A   20029.54791435  .00001264  00000-0  29673-4 0  9990",
    tle2: "2 25544  51.6431 308.0654 0005418  78.2648 343.1048 15.49400738209680",
    ipfsCID: undefined,
    owner: null,
    lastUpdate: Date.now(),
    active: true,
  },
];

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [nodes, setNodes] = useState<NodeRecord[]>(initialNodes);
  const [satellites, setSatellites] = useState<SatelliteRecord[]>(initialSatellites);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);

  function addNode(n: Omit<NodeRecord, "id" | "owner">) {
    const newNode: NodeRecord = {
      id: randomId("node"),
      owner: address ?? null,
      ...n,
    };
    setNodes((s) => [newNode, ...s]);
    return newNode;
  }

  function addSatellite(sat: Omit<SatelliteRecord, "id" | "owner" | "lastUpdate">) {
    const newSat: SatelliteRecord = {
      id: randomId("sat"),
      owner: address ?? null,
      lastUpdate: Date.now(),
      active: true,
      ...sat,
    };
    setSatellites((p) => [newSat, ...p]);
    return newSat;
  }

  function updateNode(id: string, patch: Partial<NodeRecord>) {
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function updateSatellite(id: string, patch: Partial<SatelliteRecord>) {
    setSatellites((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addBooking(b: Omit<BookingRecord, "id" | "requester">) {
    const booking: BookingRecord = {
      id: randomId("booking"),
      requester: address ?? null,
      status: "pending",
      ...b,
    };
    setBookings((p) => [booking, ...p]);
    return booking;
  }

  function updateBooking(id: string, patch: Partial<BookingRecord>) {
    setBookings((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  const value = useMemo(
  () => ({ nodes, satellites, bookings, addNode, addSatellite, addBooking, updateBooking, updateNode, updateSatellite }),
    [nodes, satellites, bookings, address]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
