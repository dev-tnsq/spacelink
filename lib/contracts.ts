// Contract addresses from deployment
export const CONTRACT_ADDRESSES = {
  priceOracleAggregator: "0x92b8619B268BcD074c3502d4AFa4d816e7f710a4",
  tokenRegistry: "0xAB320FC7B3B53967ED67e6bB141C179D80d1e0e6",
  oracleAggregator: "0xB56c32C53ffdDEF7d4544683a91cCCdf5C4fAb98",
  paymentRouter: "0xbd6737Ec181c402243B700DEE28FBd48f425758f",
  ipfsAdapter: "0xD7fcF6cf23b00829Fd64F1956Ad0227a11DB0A01",
  creditcoinCreditAdapter: "0xc1fD511958459DeF65445124e702a2Ff3537f090",
  marketplace: "0x92C2C695E7742e43201E002f9CF33a0C675d688f",
  rewards: "0xf3e2Cd25CF851c4BB07eA6193F548DC00b20CA7e",
  bnplLoanManager: "0xDe7D65F7Bc65c9abbcC28c6503e0eC8eD8eD72f0",
  liquidStaking: "0x50A31b5e077cf6CE41ABBc703f22B5A794414824",
  passExchange: "0x4eb908db04863EEd67d4119574b0559081964e1E",
} as const;

// Creditcoin Testnet configuration
export const CREDITCOIN_TESTNET = {
  id: 102031,
  name: "Creditcoin Testnet",
  network: "creditcoin-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Creditcoin",
    symbol: "CTC",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.cc3-testnet.creditcoin.network"],
    },
    public: {
      http: ["https://rpc.cc3-testnet.creditcoin.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Creditcoin Explorer",
      url: "https://explorer.cc3-testnet.creditcoin.network",
    },
  },
  testnet: true,
} as const;