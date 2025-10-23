import { NextResponse } from 'next/server'

// Pinata-only IPFS upload endpoint. Expects POST with JSON body and returns { cid }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const jwt = process.env.PINATA_JWT;
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;

    if (!jwt && !(apiKey && apiSecret)) {
      return NextResponse.json({ error: 'Missing Pinata credentials (PINATA_JWT or PINATA_API_KEY+PINATA_API_SECRET).' }, { status: 500 });
    }

    const pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
    };

    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    } else {
      // Pinata legacy header keys: include in headers
      headers['pinata_api_key'] = apiKey!;
      headers['pinata_secret_api_key'] = apiSecret!;
    }

    const res = await fetch(pinataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: 'Pinata upload failed', details: txt }, { status: res.status });
    }

    const data = await res.json();
    // Pinata returns IpfsHash on success
    const cid = data?.IpfsHash || data?.hash || null;
    if (!cid) {
      return NextResponse.json({ error: 'Pinata did not return a CID', details: data }, { status: 500 });
    }

    return NextResponse.json({ cid });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
