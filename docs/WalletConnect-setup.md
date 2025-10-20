Setup — WalletConnect (Web3Modal + wagmi)

This project now uses Web3Modal (v2) + wagmi to provide WalletConnect v2 and injected wallet support.

Required environment variables (add to your .env.local):

- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="<your WalletConnect Cloud projectId>"
- NEXT_PUBLIC_CREDITCOIN_CHAIN_ID="<decimal or hex chain id, e.g. 1337 or 0x539>"
- NEXT_PUBLIC_CREDITCOIN_RPC_URL="https://your-creditcoin-rpc.example" (optional; recommended for custom chain)
- NEXT_PUBLIC_CREDITCOIN_CHAIN_NAME="Creditcoin" (optional)
- NEXT_PUBLIC_CREDITCOIN_CHAIN_SYMBOL="CTC" (optional)

Install new dependencies:

```bash
# yarn
yarn
# or with pnpm
pnpm install
# or npm
npm install
```

Start dev:

```bash
yarn dev
```

Notes:
- Web3Modal requires a WalletConnect Cloud projectId for v2. Get one at https://cloud.walletconnect.com.
- The `WalletProvider` will read those envs and configure wagmi chains accordingly.
- If you prefer not to use WalletConnect Cloud, you can configure other providers / RPCs via the wagmi config.
