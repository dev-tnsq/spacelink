export async function uploadJsonToIpfs(json: any): Promise<string> {
  const res = await fetch('/api/ipfs/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'IPFS upload failed');
  return data.cid;
}
