"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useNetwork } from "@/context/NetworkContext";

export interface BlockNotification {
  height: number;
  epoch: number;
  block_hash: string;
  state_root: string;
  proposer: string;
  timestamp_ms: number;
  tx_count: number;
  gas_used: number;
}

/**
 * Subscribe to new finalized blocks via WebSocket.
 *
 * Returns the latest block notification and a monotonically increasing
 * `blockTick` counter that increments on each new block — useful as a
 * dependency for triggering refetches.
 *
 * Falls back to polling at 5s if the WebSocket connection fails.
 */
export function useBlockSubscription() {
  const { network } = useNetwork();
  const [latestBlock, setLatestBlock] = useState<BlockNotification | null>(null);
  const [blockTick, setBlockTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const subIdRef = useRef<string | null>(null);

  const bump = useCallback(() => {
    setBlockTick((t) => t + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let rpcIdCounter = 1;

    function connect() {
      // Clean up previous connection.
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
      }

      const ws = new WebSocket(network.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        // Subscribe to new blocks.
        const id = rpcIdCounter++;
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "solen_subscribeNewBlocks",
            params: [],
          })
        );
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);

          // Subscription ID response.
          if (msg.result && typeof msg.result === "string" && msg.id) {
            subIdRef.current = msg.result;
            return;
          }

          // Subscription notification.
          if (msg.method === "solen_newBlock" && msg.params?.result) {
            const block = msg.params.result as BlockNotification;
            setLatestBlock(block);
            bump();
          }
        } catch {
          // Ignore parse errors.
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        subIdRef.current = null;
        // Start fallback polling.
        if (!fallbackTimer.current) {
          fallbackTimer.current = setInterval(bump, 5000);
        }
        // Reconnect after 3s.
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, which handles reconnect.
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
  }, [network.wsUrl, bump]);

  return { latestBlock, blockTick, connected };
}
