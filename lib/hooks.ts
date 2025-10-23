import { useEffect, useState } from 'react'
import { createPublicClient, http, type Address } from 'viem'
import { CONTRACT_ADDRESSES } from './contracts'
import { MARKETPLACE_ABI, ERC20_ABI } from './abis'
import { CREDITCOIN_TESTNET } from './contracts'

// Create public client for reading contract data
const publicClient = createPublicClient({
  chain: CREDITCOIN_TESTNET,
  transport: http(),
})

// Marketplace Contract Hooks
export function useNodeCount() {
  const [data, setData] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'nodeCount',
        })
        setData(result as bigint)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading, error }
}

export function useSatelliteCount() {
  const [data, setData] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'satelliteCount',
        })
        setData(result as bigint)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading, error }
}

export function useGetNode(nodeId: bigint) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!nodeId) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getNode',
          args: [nodeId],
        })
        setData(result)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [nodeId])

  return { data, isLoading, error }
}

export function useGetSatellite(satId: bigint) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!satId) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getSatellite',
          args: [satId],
        })
        setData(result)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [satId])

  return { data, isLoading, error }
}

export function useGetOperatorNodes(operator: `0x${string}`) {
  const [data, setData] = useState<bigint[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!operator) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getOperatorNodes',
          args: [operator],
        })
        setData(result as bigint[])
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [operator])

  return { data, isLoading, error }
}

export function useGetOperatorSatellites(operator: `0x${string}`) {
  const [data, setData] = useState<bigint[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!operator) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getOperatorSatellites',
          args: [operator],
        })
        setData(result as bigint[])
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [operator])

  return { data, isLoading, error }
}

export function useGetPass(passId: bigint) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!passId) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getPass',
          args: [passId],
        })
        setData(result)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [passId])

  return { data, isLoading, error }
}

export function usePassCount() {
  const [data, setData] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'passCount',
        })
        setData(result as bigint)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading, error }
}

// Write hooks - these need wallet client from context
export function useRegisterNode() {
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const registerNode = async (walletClient: any, lat: bigint, lon: bigint, specs: string, uptime: bigint, ipfsCID: string, value: bigint) => {
    if (!walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsPending(true)
    setIsError(false)
    setError(null)

    try {
      // Check if wallet is on the correct chain
      const currentChainId = await walletClient.getChainId()
      const expectedChainId = 102031 // Creditcoin Testnet

      if (currentChainId !== expectedChainId) {
        throw new Error(`Please switch your wallet to Creditcoin Testnet (Chain ID: ${expectedChainId}). Current chain: ${currentChainId}`)
      }

      console.log('Calling registerNode with:', { lat, lon, specs, uptime, ipfsCID, value: value.toString() })
      
      // Check if the contract is paused
      let isPaused: boolean;
      try {
        isPaused = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'paused',
        }) as boolean
        console.log('Contract paused status:', isPaused);
      } catch (pausedError) {
        console.log('Could not check paused status:', pausedError)
        throw new Error('Could not verify contract status. Please try again.')
      }
      
      if (isPaused) {
        throw new Error('Contract is currently paused')
      }

      // Check balance
      const balance = await publicClient.getBalance({ address: walletClient.account.address })
      console.log('Wallet balance:', balance.toString(), 'Required stake:', value.toString())
      if (balance < value) {
        throw new Error(`Insufficient balance. You have ${balance} wei, but need ${value} wei for stake.`)
      }
      
      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.marketplace as Address,
        abi: MARKETPLACE_ABI,
        functionName: 'registerNode',
        args: [lat, lon, specs, uptime, ipfsCID],
        value: value,
        chain: CREDITCOIN_TESTNET,
      })
      
      console.log('Transaction hash:', txHash)
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash 
      })
      
      console.log('Transaction receipt:', receipt)
      
      if (receipt.status === 'reverted') {
        console.error('Transaction reverted. Receipt:', receipt)
        throw new Error('Transaction reverted - node registration failed. Check that you have enough CTC balance and all fields are valid.')
      }
      
      console.log('Node registration successful!')
      return txHash
    } catch (err) {
      setIsError(true)
      setError(err as Error)
      throw err
    } finally {
      setIsPending(false)
    }
  }

  return { registerNode, isPending, isError, error }
}

export function useRegisterSatellite() {
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const registerSatellite = async (walletClient: any, tle1: string, tle2: string, ipfsCID: string, value: bigint) => {
    if (!walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsPending(true)
    setIsError(false)
    setError(null)

    try {
      // Check if wallet is on the correct chain
      const currentChainId = await walletClient.getChainId()
      const expectedChainId = 102031 // Creditcoin Testnet

      if (currentChainId !== expectedChainId) {
        throw new Error(`Please switch your wallet to Creditcoin Testnet (Chain ID: ${expectedChainId}). Current chain: ${currentChainId}`)
      }

      console.log('Calling registerSatellite with:', { tle1: tle1.length, tle2: tle2.length, ipfsCID, value: value.toString() })
      console.log('TLE1 starts with:', tle1.substring(0, 5))
      console.log('TLE2 starts with:', tle2.substring(0, 5))
      
      // Check if the contract is paused
      try {
        const isPaused = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'paused',
        }) as boolean
        console.log('Contract paused status:', isPaused)
        
        if (isPaused) {
          throw new Error('Contract is currently paused')
        }
      } catch (pausedError) {
        console.log('Could not check paused status:', pausedError)
      }
      
      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.marketplace as Address,
        abi: MARKETPLACE_ABI,
        functionName: 'registerSatellite',
        args: [tle1, tle2, ipfsCID],
        value: value,
        chain: CREDITCOIN_TESTNET,
      })
      
      console.log('Transaction hash:', txHash)
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash 
      })
      
      console.log('Transaction receipt:', receipt)
      
      if (receipt.status === 'reverted') {
        console.error('Transaction reverted. Receipt:', receipt)
        throw new Error('Transaction reverted - satellite registration failed. Check that you have enough CTC balance and all fields are valid.')
      }
      
      console.log('Satellite registration successful!')
      return txHash
    } catch (err) {
      setIsError(true)
      setError(err as Error)
      throw err
    } finally {
      setIsPending(false)
    }
  }

  return { registerSatellite, isPending, isError, error }
}

export function useBookPass() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const bookPass = async (walletClient: any, nodeId: bigint, satId: bigint, timestamp: bigint, durationMin: bigint, token: `0x${string}`, value: bigint) => {
    if (!walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsPending(true)
    setIsError(false)
    setError(null)

    try {
      // Ensure on correct chain
      const currentChainId = await walletClient.getChainId()
      const expectedChainId = 102031 // Creditcoin Testnet
      if (currentChainId !== expectedChainId) {
        throw new Error(`Please switch your wallet to Creditcoin Testnet (Chain ID: ${expectedChainId}). Current chain: ${currentChainId}`)
      }

      // Check if contract is paused
      let isPaused = false
      try {
        isPaused = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'paused',
        }) as boolean
      } catch (e) {
        console.log('Could not determine paused state', e)
      }
      if (isPaused) throw new Error('Contract is currently paused')

      // Check balance
      const balance = await publicClient.getBalance({ address: walletClient.account.address })
      if (balance < value) {
        throw new Error(`Insufficient balance. You have ${balance} wei, but need ${value} wei for this booking.`)
      }

      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.marketplace as Address,
        abi: MARKETPLACE_ABI,
        functionName: 'bookPass',
        args: [nodeId, satId, timestamp, durationMin, token, value],
  value: token === '0x0000000000000000000000000000000000000000' ? value : BigInt(0),
        chain: CREDITCOIN_TESTNET,
      })

      setHash(txHash)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted - booking failed')
      }

      return txHash
    } catch (err) {
      setIsError(true)
      setError(err as Error)
      throw err
    } finally {
      setIsPending(false)
    }
  }

  const isSuccess = !isPending && !isError && Boolean(hash)
  return { bookPass, hash, isPending, isError, error, isLoading: isPending, isSuccess, isConfirmed: isSuccess, txHash: hash }
}


export function useCompletePass() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const completePass = async (
    passId: bigint,
    proofCID: string,
    signalStrength: bigint,
    dataSizeBytes: bigint,
    band: string,
    tleSnapshotHash: `0x${string}`
  ) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Complete pass:', { passId, proofCID, signalStrength, dataSizeBytes, band, tleSnapshotHash })
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  const isSuccessComplete = !isPending && !isError && Boolean(hash)
  return { completePass, hash, isPending, isError, error, isLoading: isPending, isSuccess: isSuccessComplete, isConfirmed: isSuccessComplete, txHash: hash }
}

export function useConfirmPass() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const confirmPass = async (passId: bigint) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Confirm pass:', passId)
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  const isSuccessConfirm = !isPending && !isError && Boolean(hash)
  return { confirmPass, hash, isPending, isError, error, isLoading: isPending, isSuccess: isSuccessConfirm, isConfirmed: isSuccessConfirm, txHash: hash }
}

export function useCancelPass() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const cancelPass = async (passId: bigint) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Cancel pass:', passId)
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  const isSuccessCancel = !isPending && !isError && Boolean(hash)
  return { cancelPass, hash, isPending, isError, error, isLoading: isPending, isSuccess: isSuccessCancel, isConfirmed: isSuccessCancel, txHash: hash }
}

export function useUpdateNode() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateNode = async (nodeId: bigint, lat: bigint, lon: bigint, specs: string, uptime: bigint, ipfsCID: string) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Update node:', { nodeId, lat, lon, specs, uptime, ipfsCID })
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  return { updateNode, hash, isPending, isError, error }
}

export function useUpdateSatellite() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateSatellite = async (satId: bigint, tle1: string, tle2: string, ipfsCID: string) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Update satellite:', { satId, tle1, tle2, ipfsCID })
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  return { updateSatellite, hash, isPending, isError, error }
}

export function useDeactivateSatellite() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deactivateSatellite = async (satId: bigint) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Deactivate satellite:', satId)
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  return { deactivateSatellite, hash, isPending, isError, error }
}

// ERC20 hooks for token interactions
export function useTokenBalance(tokenAddress: `0x${string}`, account: `0x${string}`) {
  const [data, setData] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!tokenAddress || !account) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account],
        })
        setData(result as bigint)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [tokenAddress, account])

  return { data, isLoading, error }
}

export function useTokenAllowance(tokenAddress: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`) {
  const [data, setData] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!tokenAddress || !owner || !spender) return

      setIsLoading(true)
      setError(null)
      try {
        const result = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [owner, spender],
        })
        setData(result as bigint)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [tokenAddress, owner, spender])

  return { data, isLoading, error }
}

export function useApproveToken() {
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const approve = async (tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    setIsPending(true)
    setIsError(false)
    setError(null)
    try {
      console.log('Approve token:', { tokenAddress, spender, amount })
    } catch (err) {
      setIsError(true)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }

  return { approve, hash, isPending, isError, error }
}

// Utility functions for fetching contract data
export async function fetchAllNodes() {
  try {
    console.log('Fetching node count...')
    const nodeCount = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.marketplace as Address,
      abi: MARKETPLACE_ABI,
      functionName: 'nodeCount',
    }) as bigint

    console.log('Node count from contract:', nodeCount.toString())

    const nodes = []
    for (let i = BigInt(1); i <= nodeCount; i++) {
      try {
        console.log(`Fetching node ${i}...`)
        const nodeData = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getNode',
          args: [i],
        }) as any

        console.log(`Raw node ${i} data:`, nodeData)

        if (nodeData) {
          try {
            const { owner, lat, lon, specs, active, uptime, ipfsCID, stakeAmount, totalRelays, availability } = nodeData
            
            // Extract station name from specs if it exists
            let nodeName = `Node ${i}`;
            let cleanSpecs = specs;
            if (specs && typeof specs === 'string' && specs.startsWith('NAME:')) {
              const nameMatch = specs.match(/^NAME:([^|]+)/);
              if (nameMatch) {
                nodeName = nameMatch[1].trim();
                cleanSpecs = specs.replace(/^NAME:[^|]+\|\s*/, '');
              }
            }
            
            // Safely process availability array
            let availabilityArray: number[] = [];
            try {
              if (availability && Array.isArray(availability)) {
                availabilityArray = availability.map((n: bigint) => Number(n)).filter(n => !isNaN(n) && isFinite(n));
              }
            } catch (availError) {
              console.warn(`Error processing availability for node ${i}:`, availError);
              availabilityArray = [];
            }
            
            const processedNode = {
              id: i.toString(),
              name: nodeName,
              lat: Number(lat) / 1e4, // Convert from scaled coordinates (assuming 10000 scale)
              lon: Number(lon) / 1e4,
              description: cleanSpecs || '',
              specs: cleanSpecs || '',
              owner,
              active: Boolean(active),
              uptime: Number(uptime) || 0,
              ipfsCID: ipfsCID || '',
              stakeAmount: stakeAmount ? stakeAmount.toString() : '0',
              totalRelays: Number(totalRelays) || 0,
              availability: availabilityArray,
            }
            console.log(`Processed node ${i}:`, processedNode)
            nodes.push(processedNode)
          } catch (nodeProcessError) {
            console.error(`Error processing node ${i} data:`, nodeProcessError, nodeData)
          }
        }
      } catch (error) {
        console.error(`Error fetching node ${i}:`, error)
      }
    }
    console.log('Total fetched nodes:', nodes)
    return nodes
  } catch (error) {
    console.error('Error fetching nodes:', error)
    return []
  }
}

export async function fetchAllSatellites() {
  try {
    const satelliteCount = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.marketplace as Address,
      abi: MARKETPLACE_ABI,
      functionName: 'satelliteCount',
    }) as bigint

    const satellites = []
    for (let i = BigInt(1); i <= satelliteCount; i++) {
      try {
        const satData = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getSatellite',
          args: [i],
        }) as any

        if (satData) {
          const { owner, tle1, tle2, active, lastUpdate, ipfsCID } = satData
          satellites.push({
            id: i.toString(),
            name: `Satellite ${i}`,
            tle1,
            tle2,
            ipfsCID,
            owner,
            lastUpdate: Number(lastUpdate),
            active,
          })
        }
      } catch (error) {
        console.error(`Error fetching satellite ${i}:`, error)
      }
    }
    return satellites
  } catch (error) {
    console.error('Error fetching satellites:', error)
    return []
  }
}

export async function fetchAllPasses() {
  try {
    const passCount = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.marketplace as Address,
      abi: MARKETPLACE_ABI,
      functionName: 'passCount',
    }) as bigint

    const passes = []
    for (let i = BigInt(1); i <= passCount; i++) {
      try {
        const passData = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.marketplace as Address,
          abi: MARKETPLACE_ABI,
          functionName: 'getPass',
          args: [i],
        }) as any

        if (passData) {
          const timestampNum = Number(passData.timestamp)
          const durationMinNum = Number(passData.durationMin)
          // map numeric state to status string
          const stateNum = Number(passData.state)
          let status: "pending" | "confirmed" | "completed" | "cancelled" = "pending"
          switch (stateNum) {
            case 0:
              status = "pending"
              break
            case 1:
              status = "confirmed"
              break
            case 2:
              status = "completed"
              break
            case 3:
              status = "cancelled"
              break
            default:
              status = "pending"
          }

          passes.push({
            id: i.toString(),
            operator: passData.operator,
            nodeId: passData.nodeId.toString(),
            satId: passData.satId.toString(),
            timestamp: timestampNum,
            durationMin: durationMinNum,
            start: timestampNum,
            end: timestampNum + durationMinNum * 60,
            state: stateNum,
            status,
            payment: passData.payment ? {
              token: passData.payment.token,
              amount: passData.payment.amount.toString(),
            } : undefined,
            proofCID: passData.proofCID,
            verified: passData.verified,
            metrics: passData.metrics ? {
              signalStrength: Number(passData.metrics.signalStrength),
              dataSizeBytes: Number(passData.metrics.dataSizeBytes),
              band: passData.metrics.band,
            } : undefined,
            tleSnapshotHash: passData.tleSnapshotHash,
          })
        }
      } catch (error) {
        console.error(`Error fetching pass ${i}:`, error)
      }
    }
    return passes
  } catch (error) {
    console.error('Error fetching passes:', error)
    return []
  }
}

// Fetch JSON metadata from IPFS via public gateway (simple helper)
export async function fetchIpfsJson(cid: string) {
  try {
    if (!cid) return null
    const url = cid.startsWith('http') ? cid : `https://ipfs.io/ipfs/${cid}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('Failed to fetch IPFS JSON:', res.status, res.statusText)
      return null
    }
    const json = await res.json()
    return json
  } catch (err) {
    console.error('Error fetching IPFS JSON:', err)
    return null
  }
}

// Helper: treat both zero-address and legacy native token sentinel as native
export function isNativeToken(address?: string | null) {
  if (!address) return true
  const a = address.toLowerCase()
  return a === '0x0000000000000000000000000000000000000000' || a === '0x0000000000000000000000000000000000000001'
}

// Get token decimals (native token falls back to chain config)
export async function getTokenDecimals(tokenAddress: `0x${string}` | string | null) {
  try {
    if (!tokenAddress || isNativeToken(tokenAddress)) return CREDITCOIN_TESTNET.nativeCurrency.decimals
    const result = await publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }) as bigint
    return Number(result)
  } catch (err) {
    console.warn('Could not fetch token decimals, default to 18', err)
    return 18
  }
}

export async function getTokenSymbol(tokenAddress: `0x${string}` | string | null) {
  try {
    if (!tokenAddress || isNativeToken(tokenAddress)) return CREDITCOIN_TESTNET.nativeCurrency.symbol
    const result = await publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }) as string
    return result
  } catch (err) {
    console.warn('Could not fetch token symbol', err)
    return 'TOKEN'
  }
}

// Read ERC20 allowance (owner -> spender)
export async function getErc20Allowance(tokenAddress: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`) {
  try {
    const result = await publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint
    return BigInt(result.toString())
  } catch (err) {
    console.error('Error reading ERC20 allowance:', err)
    return BigInt(0)
  }
}

// Approve ERC20 token for spender via wallet client
export async function approveErc20(walletClient: any, tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) {
  if (!walletClient) throw new Error('Wallet not connected')
  try {
    const txHash = await walletClient.writeContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
      chain: CREDITCOIN_TESTNET,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    if (receipt.status === 'reverted') throw new Error('Approve transaction reverted')
    return txHash
  } catch (err) {
    console.error('Error approving ERC20:', err)
    throw err
  }
}