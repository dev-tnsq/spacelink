# 📦 IPFS Integration Guide for SpaceLink Frontend

## Overview

SpaceLink uses IPFS (InterPlanetary File System) for decentralized storage of ground station metadata, satellite specs, and communication proofs. This guide shows you how to integrate IPFS in your Next.js frontend.

## Architecture

```
┌─────────────────┐
│  Next.js App    │
│  (Frontend)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Upload File      ┌──────────────┐
│  Pinata API     │ ◄──────────────────── │  User File   │
│  (IPFS Service) │                       └──────────────┘
└────────┬────────┘
         │
         │ Returns CID
         ▼
┌─────────────────┐
│ IPFSAdapter     │ ◄─── registerCID(cid)
│ Smart Contract  │
└─────────────────┘
         │
         │ Store on-chain
         ▼
┌─────────────────┐
│  Blockchain     │
│  (Creditcoin)   │
└─────────────────┘
```

**Key Points:**
- File upload happens OFF-CHAIN via HTTP to IPFS service (Pinata/Infura)
- IPFS returns a CID (Content Identifier)
- Smart contract stores CID on-chain for tracking/verification
- Anyone can download files using CID from any IPFS gateway

## Installation

### Option 1: Pinata (Recommended for Production)

```bash
npm install pinata-web3
# or
pnpm add pinata-web3
```

### Option 2: IPFS HTTP Client (Self-hosted or Infura)

```bash
npm install ipfs-http-client
# or
pnpm add ipfs-http-client
```

## Setup

### Pinata Configuration

1. Sign up at https://pinata.cloud
2. Create API Key:
   - Go to Dashboard → API Keys
   - Click "New Key"
   - Enable permissions: `pinFileToIPFS`, `pinJSONToIPFS`
   - Copy JWT token

3. Create `.env.local`:
```env
NEXT_PUBLIC_PINATA_JWT=your_jwt_token_here
NEXT_PUBLIC_PINATA_GATEWAY=your-gateway.mypinata.cloud
```

### Infura Configuration (Alternative)

1. Sign up at https://infura.io
2. Create IPFS project
3. Get Project ID and Secret

```env
NEXT_PUBLIC_INFURA_PROJECT_ID=your_project_id
NEXT_PUBLIC_INFURA_PROJECT_SECRET=your_project_secret
```

## Implementation

### 1. Create IPFS Helper Functions

Create `lib/ipfs.ts`:

```typescript
import { PinataSDK } from "pinata-web3";

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});

export interface IPFSUploadResult {
  cid: string;
  url: string;
  size: number;
}

/**
 * Upload file to IPFS via Pinata
 */
export async function uploadFileToIPFS(
  file: File,
  metadata?: { name?: string; keyvalues?: Record<string, string> }
): Promise<IPFSUploadResult> {
  try {
    const upload = await pinata.upload.file(file).addMetadata({
      name: metadata?.name || file.name,
      keyvalues: metadata?.keyvalues || {},
    });

    return {
      cid: upload.IpfsHash,
      url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.IpfsHash}`,
      size: file.size,
    };
  } catch (error) {
    console.error("IPFS upload error:", error);
    throw new Error("Failed to upload file to IPFS");
  }
}

/**
 * Upload JSON object to IPFS
 */
export async function uploadJSONToIPFS(
  data: object,
  metadata?: { name?: string }
): Promise<IPFSUploadResult> {
  try {
    const upload = await pinata.upload.json(data).addMetadata({
      name: metadata?.name || "metadata.json",
    });

    return {
      cid: upload.IpfsHash,
      url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.IpfsHash}`,
      size: JSON.stringify(data).length,
    };
  } catch (error) {
    console.error("IPFS JSON upload error:", error);
    throw new Error("Failed to upload JSON to IPFS");
  }
}

/**
 * Download file from IPFS
 */
export async function downloadFromIPFS(cid: string): Promise<any> {
  try {
    const url = `https://ipfs.io/ipfs/${cid}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }
    
    return await response.blob();
  } catch (error) {
    console.error("IPFS download error:", error);
    throw new Error("Failed to download from IPFS");
  }
}

/**
 * Get IPFS gateway URL for a CID
 */
export function getIPFSUrl(cid: string): string {
  if (process.env.NEXT_PUBLIC_PINATA_GATEWAY) {
    return `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${cid}`;
  }
  return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Calculate metadata hash for smart contract
 */
export function calculateMetadataHash(metadata: object): string {
  const ethers = require("ethers");
  const json = JSON.stringify(metadata);
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(json));
}
```

### 2. Register Ground Station with IPFS

Create `app/register-node/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { uploadFileToIPFS, uploadJSONToIPFS, calculateMetadataHash } from "@/lib/ipfs";
import { ethers } from "ethers";
import MarketplaceABI from "@/contracts/abi/Marketplace.json";

const MARKETPLACE_ADDRESS = "0x..."; // From deployment

export default function RegisterNodePage() {
  const { signer } = useWallet();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signer) return;

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      
      // 1. Upload station photo to IPFS
      let photoCID = "";
      if (photo) {
        const photoUpload = await uploadFileToIPFS(photo, {
          name: `station-photo-${Date.now()}`,
          keyvalues: { type: "ground-station-photo" }
        });
        photoCID = photoUpload.cid;
        console.log("Photo uploaded:", photoUpload.url);
      }

      // 2. Upload station metadata (JSON)
      const metadata = {
        name: formData.get("name"),
        description: formData.get("description"),
        equipment: formData.get("equipment"),
        frequencies: formData.get("frequencies"),
        photoCID,
        timestamp: Date.now(),
      };

      const metadataUpload = await uploadJSONToIPFS(metadata, {
        name: `station-metadata-${Date.now()}.json`
      });
      console.log("Metadata uploaded:", metadataUpload.url);

      // 3. Calculate metadata hash
      const metadataHash = calculateMetadataHash(metadata);

      // 4. Call smart contract
      const marketplace = new ethers.Contract(
        MARKETPLACE_ADDRESS,
        MarketplaceABI,
        signer
      );

      const lat = Math.floor(parseFloat(formData.get("lat") as string) * 10000);
      const lon = Math.floor(parseFloat(formData.get("lon") as string) * 10000);
      const specs = formData.get("specs") as string;
      const uptime = parseInt(formData.get("uptime") as string);

      const tx = await marketplace.registerNode(
        lat,
        lon,
        specs,
        uptime,
        metadataUpload.cid, // Pass CID to smart contract
        { value: ethers.utils.parseEther("1") } // 1 CTC stake
      );

      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Node registered successfully!");

      // 5. Register CID with IPFSAdapter (optional - for tracking)
      const ipfsAdapter = new ethers.Contract(
        "0x...", // IPFSAdapter address
        ["function registerCID(string calldata _cid, bytes32 _metadataHash) external payable"],
        signer
      );

      const registerTx = await ipfsAdapter.registerCID(
        metadataUpload.cid,
        metadataHash,
        { value: ethers.utils.parseEther("0.001") } // Storage fee
      );
      await registerTx.wait();

      alert("Ground station registered successfully!");
    } catch (error) {
      console.error("Registration error:", error);
      alert("Failed to register station");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <h1 className="text-2xl font-bold">Register Ground Station</h1>
      
      <div>
        <label htmlFor="name">Station Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="lat">Latitude</label>
        <input
          id="lat"
          name="lat"
          type="number"
          step="0.0001"
          required
          placeholder="40.4583"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="lon">Longitude</label>
        <input
          id="lon"
          name="lon"
          type="number"
          step="0.0001"
          required
          placeholder="-73.9583"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="specs">Equipment Specs</label>
        <input
          id="specs"
          name="specs"
          type="text"
          required
          placeholder="S-band, 2.4GHz, 10m dish"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="uptime">Uptime Guarantee (%)</label>
        <input
          id="uptime"
          name="uptime"
          type="number"
          min="0"
          max="100"
          required
          placeholder="95"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="photo">Station Photo</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? "Registering..." : "Register Station (1 CTC)"}
      </button>
    </form>
  );
}
```

### 3. Register Satellite with TLE

Create `app/register-satellite/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { uploadJSONToIPFS, calculateMetadataHash } from "@/lib/ipfs";
import { ethers } from "ethers";
import MarketplaceABI from "@/contracts/abi/Marketplace.json";

const MARKETPLACE_ADDRESS = "0x...";

export default function RegisterSatellitePage() {
  const { signer } = useWallet();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signer) return;

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);

      // 1. Prepare metadata
      const metadata = {
        name: formData.get("name"),
        operator: formData.get("operator"),
        frequency: formData.get("frequency"),
        mission: formData.get("mission"),
        launchDate: formData.get("launchDate"),
        timestamp: Date.now(),
      };

      // 2. Upload to IPFS
      const upload = await uploadJSONToIPFS(metadata, {
        name: `satellite-${formData.get("noradId")}-${Date.now()}.json`
      });
      console.log("Satellite metadata uploaded:", upload.url);

      // 3. Call smart contract
      const marketplace = new ethers.Contract(
        MARKETPLACE_ADDRESS,
        MarketplaceABI,
        signer
      );

      const tle1 = formData.get("tle1") as string;
      const tle2 = formData.get("tle2") as string;

      const tx = await marketplace.registerSatellite(
        tle1,
        tle2,
        upload.cid
      );

      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      alert("Satellite registered successfully!");

    } catch (error) {
      console.error("Registration error:", error);
      alert("Failed to register satellite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <h1 className="text-2xl font-bold">Register Satellite</h1>

      <div>
        <label htmlFor="name">Satellite Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="ISS (ZARYA)"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="noradId">NORAD Catalog Number</label>
        <input
          id="noradId"
          name="noradId"
          type="text"
          required
          placeholder="25544"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="tle1">TLE Line 1</label>
        <input
          id="tle1"
          name="tle1"
          type="text"
          required
          placeholder="1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005"
          className="w-full p-2 border rounded font-mono text-sm"
        />
      </div>

      <div>
        <label htmlFor="tle2">TLE Line 2</label>
        <input
          id="tle2"
          name="tle2"
          type="text"
          required
          placeholder="2 25544  51.6400 123.4567 0001234  45.6789  12.3456 15.50000000123456"
          className="w-full p-2 border rounded font-mono text-sm"
        />
      </div>

      <div>
        <label htmlFor="frequency">Communication Frequency</label>
        <input
          id="frequency"
          name="frequency"
          type="text"
          placeholder="145.800 MHz"
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="mission">Mission Description</label>
        <textarea
          id="mission"
          name="mission"
          rows={4}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? "Registering..." : "Register Satellite"}
      </button>
    </form>
  );
}
```

### 4. Display Node/Satellite Info

Create `components/station-card.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { downloadFromIPFS, getIPFSUrl } from "@/lib/ipfs";
import Image from "next/image";

interface StationCardProps {
  ipfsCID: string;
  nodeId: number;
  lat: number;
  lon: number;
  specs: string;
}

export function StationCard({ ipfsCID, nodeId, lat, lon, specs }: StationCardProps) {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await downloadFromIPFS(ipfsCID);
        setMetadata(data);
      } catch (error) {
        console.error("Failed to load metadata:", error);
      } finally {
        setLoading(false);
      }
    };

    if (ipfsCID) {
      loadMetadata();
    }
  }, [ipfsCID]);

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <h3 className="text-xl font-bold">{metadata?.name || `Node #${nodeId}`}</h3>
      
      {metadata?.photoCID && (
        <Image
          src={getIPFSUrl(metadata.photoCID)}
          alt="Station photo"
          width={400}
          height={300}
          className="rounded"
        />
      )}

      <div>
        <strong>Location:</strong> {lat / 10000}°, {lon / 10000}°
      </div>

      <div>
        <strong>Equipment:</strong> {specs}
      </div>

      {metadata?.description && (
        <div>
          <strong>Description:</strong> {metadata.description}
        </div>
      )}

      <a
        href={getIPFSUrl(ipfsCID)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline text-sm"
      >
        View full metadata on IPFS →
      </a>
    </div>
  );
}
```

## Best Practices

### 1. Pin Important Files

Free IPFS nodes may not keep files forever. Pin important files:

```typescript
// Pinata automatically pins uploaded files
// For other services:
await ipfs.pin.add(cid);
```

### 2. Validate CIDs

```typescript
function isValidCID(cid: string): boolean {
  // CIDv0: Qm... (46 chars)
  // CIDv1: ba... (59+ chars)
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid) || 
         /^ba[a-z0-9]{56,}$/.test(cid);
}
```

### 3. Handle Errors Gracefully

```typescript
try {
  const data = await downloadFromIPFS(cid);
} catch (error) {
  console.error("IPFS error:", error);
  // Fallback to centralized storage if needed
  const fallbackUrl = `https://your-cdn.com/${cid}`;
}
```

### 4. Use Gateways Wisely

```typescript
// Try multiple gateways for redundancy
const gateways = [
  `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/`,
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

async function fetchFromIPFS(cid: string): Promise<Response> {
  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}${cid}`, { 
        signal: AbortSignal.timeout(5000) 
      });
      if (response.ok) return response;
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error);
    }
  }
  throw new Error("All IPFS gateways failed");
}
```

### 5. Calculate Storage Fees

```typescript
// IPFSAdapter charges fees based on file size
const storageFeePerMB = await ipfsAdapter.storageFeePerMB();
const fileSizeMB = file.size / (1024 * 1024);
const storageFee = storageFeePerMB * Math.ceil(fileSizeMB);

await ipfsAdapter.registerCID(cid, metadataHash, {
  value: storageFee
});
```

## Testing

### Local IPFS Node (Development)

```bash
# Install IPFS Desktop
# Or use CLI:
ipfs init
ipfs daemon

# Upload test file
ipfs add test.json
# Returns: QmX...

# Fetch file
ipfs cat QmX...
```

### Mock IPFS for Tests

```typescript
// __mocks__/ipfs.ts
export const uploadFileToIPFS = vi.fn().mockResolvedValue({
  cid: "QmTestCID123456789",
  url: "https://ipfs.io/ipfs/QmTestCID123456789",
  size: 1024,
});

export const downloadFromIPFS = vi.fn().mockResolvedValue({
  name: "Test Station",
  description: "Mock data",
});
```

## Troubleshooting

### Issue: "Failed to fetch from IPFS"

**Solution:** Files may not be pinned or propagated yet. Wait a few seconds and retry.

```typescript
async function fetchWithRetry(cid: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await downloadFromIPFS(cid);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}
```

### Issue: "Rate limit exceeded"

**Solution:** Use dedicated Pinata/Infura account instead of free tier.

### Issue: "CID format invalid"

**Solution:** Ensure CID is not URL-encoded or has extra whitespace:

```typescript
const cleanCID = cid.trim().replace(/^\/ipfs\//, '');
```

## Cost Estimates

### Pinata Pricing

- Free: 1 GB storage, 100 GB bandwidth/month
- Starter: $20/month - 100 GB storage, 1 TB bandwidth
- Professional: Custom pricing

### Infura Pricing

- Free: 5 GB storage, 15 GB bandwidth/month
- Growth: $50/month - 50 GB storage, 250 GB bandwidth

### On-Chain Costs

- Register CID: ~0.001 CTC (~$0.001)
- Store CID in node/satellite: Gas cost of storage write

## Resources

- Pinata Docs: https://docs.pinata.cloud
- IPFS Docs: https://docs.ipfs.tech
- CID Inspector: https://cid.ipfs.tech
- IPFS Gateway Checker: https://ipfs.github.io/public-gateway-checker/

---

**Questions? Issues?** Open a GitHub issue or join our Discord.
