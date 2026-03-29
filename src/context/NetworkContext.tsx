"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { NetworkId, NetworkConfig, networks, DEFAULT_NETWORK } from "@/lib/networks";

interface NetworkContextValue {
  network: NetworkConfig;
  networkId: NetworkId;
  setNetwork: (id: NetworkId) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networkId, setNetworkId] = useState<NetworkId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solenscan-network");
      if (saved && saved in networks && networks[saved as NetworkId].enabled) return saved as NetworkId;
    }
    return DEFAULT_NETWORK;
  });

  const setNetwork = useCallback((id: NetworkId) => {
    setNetworkId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("solenscan-network", id);
    }
  }, []);

  return (
    <NetworkContext.Provider
      value={{ network: networks[networkId], networkId, setNetwork }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
