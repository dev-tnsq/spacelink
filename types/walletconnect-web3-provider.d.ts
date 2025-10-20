declare module '@walletconnect/web3-provider' {
  // Minimal ambient type so TS stops complaining; runtime types are provided by the package.
  const WalletConnectProvider: any;
  export default WalletConnectProvider;
}
