export type NetworkId = "mainnet" | "testnet" | "devnet";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  rpcUrl: string;
  wsUrl: string;
  explorerApiUrl: string;
  color: string;
  enabled: boolean;
}

/** Derive a WebSocket URL from an HTTP RPC URL. */
function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}

const allNetworks: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "http://localhost:9944",
    wsUrl: toWsUrl(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "http://localhost:9944"),
    explorerApiUrl: process.env.NEXT_PUBLIC_MAINNET_API_URL || "http://localhost:9955",
    color: "#22c55e",
    enabled: process.env.NEXT_PUBLIC_MAINNET_ENABLED !== "false",
  },
  testnet: {
    id: "testnet",
    name: "Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_TESTNET_RPC_URL || "http://localhost:19944",
    wsUrl: toWsUrl(process.env.NEXT_PUBLIC_TESTNET_RPC_URL || "http://localhost:19944"),
    explorerApiUrl: process.env.NEXT_PUBLIC_TESTNET_API_URL || "http://localhost:19955",
    color: "#eab308",
    enabled: process.env.NEXT_PUBLIC_TESTNET_ENABLED !== "false",
  },
  devnet: {
    id: "devnet",
    name: "Devnet",
    rpcUrl: process.env.NEXT_PUBLIC_DEVNET_RPC_URL || "http://localhost:29944",
    wsUrl: toWsUrl(process.env.NEXT_PUBLIC_DEVNET_RPC_URL || "http://localhost:29944"),
    explorerApiUrl: process.env.NEXT_PUBLIC_DEVNET_API_URL || "http://localhost:29955",
    color: "#3b82f6",
    enabled: process.env.NEXT_PUBLIC_DEVNET_ENABLED !== "false",
  },
};

export const networks = allNetworks;

export const enabledNetworks = Object.values(allNetworks).filter((n) => n.enabled);

export const DEFAULT_NETWORK: NetworkId =
  enabledNetworks.length > 0 ? enabledNetworks[0].id : "devnet";
