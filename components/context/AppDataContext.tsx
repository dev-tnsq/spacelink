"use client"

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useWallet } from "./WalletContext";
import { useNodeCount, useSatelliteCount, usePassCount, fetchAllNodes, fetchAllSatellites, fetchAllPasses } from "@/lib/hooks";

export type NodeRecord = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
  specs?: string;
  owner?: string | null;
  active?: boolean;
  uptime?: number;
  ipfsCID?: string;
  stakeAmount?: string;
  totalRelays?: number;
  availability?: number[];
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
  payment?: {
    token: string;
    amount: string;
  };
  proofCID?: string;
  verified?: boolean;
  metrics?: {
    signalStrength: number;
    dataSizeBytes: number;
    band: string;
  };
  tleSnapshotHash?: string;
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
  refreshData: () => Promise<void>;
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

  // Contract data fetching hooks
  const { data: nodeCount } = useNodeCount();
  const { data: satelliteCount } = useSatelliteCount();
  const { data: passCount } = usePassCount();

  // Fetch contract data on mount and when counts change
  // useEffect(() => {
  //   let mounted = true;
  //   const loadContractData = async () => {
  //     if (!mounted) return; // Add this check

  //     try {
  //       console.log('Loading contract data... nodeCount:', nodeCount, 'satelliteCount:', satelliteCount, 'passCount:', passCount);
        
  //       // Fetch nodes from contract
  //       const contractNodes = await fetchAllNodes();
  //       console.log('Contract nodes fetched:', contractNodes);
  //       if (!mounted) return; // Add this check before setState

  //       if (contractNodes.length > 0) {
  //         // Merge contract nodes with mock data, keeping both
  //         setNodes(prevNodes => {
  //           console.log('Previous nodes:', prevNodes);
  //           // Create a map of existing mock nodes (those without numeric IDs)
  //           const mockNodes = prevNodes.filter(node => !node.id.match(/^\d+$/));
  //           console.log('Mock nodes:', mockNodes);
  //           // Combine mock nodes with contract nodes, avoiding duplicates
  //           const allNodes = [...mockNodes, ...contractNodes];
  //           console.log('All nodes after merge:', allNodes);
  //           return allNodes;
  //         });
  //       } else {
  //         console.log('No contract nodes found, keeping mock data only');
  //       }
  //       if (!mounted) return; // Add check before satellites

  //       // Fetch satellites from contract
  //       const contractSatellites = await fetchAllSatellites();
  //       if (contractSatellites.length > 0) {
  //         setSatellites(prevSats => {
  //           const mockSats = prevSats.filter(sat => !sat.id.match(/^\d+$/));
  //           return [...mockSats, ...contractSatellites];
  //         });
  //       }
  //       if (!mounted) return; // Add check before passes

  //       // Fetch passes (bookings) from contract
  //       const contractPasses = await fetchAllPasses();
  //       if (contractPasses.length > 0) {
  //         setBookings(contractPasses);
  //       }
  //     } catch (error) {
  //       console.error('Error loading contract data:', error);
  //       // Fall back to mock data if contract calls fail
  //     }
  //   };

  //   loadContractData();
  //   return () => { mounted = false; }; // Add cleanup

  // }, [nodeCount, satelliteCount, passCount]);
  // Fetch contract data on mount and when counts change
useEffect(() => {
  let mounted = true;
  let timeoutId: NodeJS.Timeout;
  
  const loadContractData = async () => {
    if (!mounted) return;
    
    try {
      console.log('Loading contract data... nodeCount:', nodeCount, 'satelliteCount:', satelliteCount, 'passCount:', passCount);
      
      // Skip if counts aren't loaded yet
      if (nodeCount === null || satelliteCount === null || passCount === null) {
        return;
      }
      
      // Fetch nodes from contract
      const contractNodes = await fetchAllNodes();
      console.log('Contract nodes fetched:', contractNodes);
      
      if (!mounted) return;
      
      if (contractNodes.length > 0) {
        setNodes(prevNodes => {
          console.log('Previous nodes:', prevNodes);
          const mockNodes = prevNodes.filter(node => !node.id.match(/^\d+$/));
          console.log('Mock nodes:', mockNodes);
          const allNodes = [...mockNodes, ...contractNodes];
          console.log('All nodes after merge:', allNodes);
          return allNodes;
        });
      }

      if (!mounted) return;
      
      // Fetch satellites from contract
      const contractSatellites = await fetchAllSatellites();
      if (contractSatellites.length > 0) {
        setSatellites(prevSats => {
          const mockSats = prevSats.filter(sat => !sat.id.match(/^\d+$/));
          return [...mockSats, ...contractSatellites];
        });
      }

      if (!mounted) return;
      
      // Fetch passes (bookings) from contract
      const contractPasses = await fetchAllPasses();
      if (contractPasses.length > 0) {
        setBookings(contractPasses);
      }
    } catch (error) {
      console.error('Error loading contract data:', error);
    }
  };

  // Debounce to prevent multiple rapid calls
  timeoutId = setTimeout(() => {
    loadContractData();
  }, 100);
  
  return () => {
    mounted = false;
    clearTimeout(timeoutId);
  };
}, [nodeCount, satelliteCount, passCount]);
  function addNode(n: Omit<NodeRecord, "id" | "owner">) {
    const newNode: NodeRecord = {
      id: randomId("node"),
      owner: address ?? null,
      ...n,
    };
    setNodes((s: NodeRecord[]) => [newNode, ...s]);
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
    setSatellites((p: SatelliteRecord[]) => [newSat, ...p]);
    return newSat;
  }

  function updateNode(id: string, patch: Partial<NodeRecord>) {
    setNodes((p: NodeRecord[]) => p.map((n: NodeRecord) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function updateSatellite(id: string, patch: Partial<SatelliteRecord>) {
    setSatellites((p: SatelliteRecord[]) => p.map((s: SatelliteRecord) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addBooking(b: Omit<BookingRecord, "id" | "requester">) {
    const booking: BookingRecord = {
      id: randomId("booking"),
      requester: address ?? null,
      status: "pending",
      ...b,
    };
    setBookings((p: BookingRecord[]) => [booking, ...p]);
    return booking;
  }

  function updateBooking(id: string, patch: Partial<BookingRecord>) {
    setBookings((p: BookingRecord[]) => p.map((b: BookingRecord) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function refreshData() {
    try {
      console.log('Refreshing data...');
      
      // Fetch fresh data from contracts
      const contractNodes = await fetchAllNodes();
      console.log('Refreshed contract nodes:', contractNodes);
      
      if (contractNodes.length > 0) {
        setNodes(prevNodes => {
          console.log('Previous nodes before refresh:', prevNodes);
          const mockNodes = prevNodes.filter(node => !node.id.match(/^\d+$/));
          console.log('Mock nodes preserved:', mockNodes);
          const newNodes = [...mockNodes, ...contractNodes];
          console.log('New nodes after refresh merge:', newNodes);
          return newNodes;
        });
      } else {
        console.log('No contract nodes found during refresh');
      }

      const contractSatellites = await fetchAllSatellites();
      if (contractSatellites.length > 0) {
        setSatellites(prevSats => {
          const mockSats = prevSats.filter(sat => !sat.id.match(/^\d+$/));
          return [...mockSats, ...contractSatellites];
        });
      }

      const contractPasses = await fetchAllPasses();
      if (contractPasses.length > 0) {
        setBookings(contractPasses);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  const value = useMemo(
  () => ({ nodes, satellites, bookings, addNode, addSatellite, addBooking, updateBooking, updateNode, updateSatellite, refreshData }),
    [nodes, satellites, bookings, address]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
