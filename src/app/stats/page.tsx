"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnBlock } from "@/hooks/useApi";
import { useBlockSubscription } from "@/hooks/useBlockSubscription";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import {
  ChainStatus,
  RpcChainStatus,
  IndexedBlock,
  ValidatorSetResponse,
} from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type HealthLevel = "healthy" | "degraded" | "down" | "unknown";

interface Health {
  level: HealthLevel;
  messages: string[];
}

function computeHealth(
  blocks: IndexedBlock[] | null,
  chainStatus: RpcChainStatus | null,
  validators: ValidatorSetResponse | null
): Health {
  if (!blocks || blocks.length === 0) {
    return { level: "unknown", messages: ["Loading network state…"] };
  }

  const targetBlockTimeMs = chainStatus?.config?.block_time_ms ?? 1000;
  const sinceLast = Date.now() - blocks[0].timestamp_ms;
  const messages: string[] = [];
  let worst: HealthLevel = "healthy";

  if (sinceLast > targetBlockTimeMs * 5) {
    messages.push(`No new block in ${Math.floor(sinceLast / 1000)}s`);
    worst = "down";
  } else if (sinceLast > targetBlockTimeMs * 2) {
    messages.push(`Block production slow: last block ${Math.floor(sinceLast / 1000)}s ago`);
    if (worst === "healthy") worst = "degraded";
  }

  if (validators && validators.total_count > 0) {
    const pct = (validators.active_count / validators.total_count) * 100;
    if (pct < 50) {
      messages.push(`Only ${validators.active_count}/${validators.total_count} validators active`);
      worst = "down";
    } else if (pct < 80) {
      messages.push(`${validators.active_count}/${validators.total_count} validators active`);
      if (worst === "healthy") worst = "degraded";
    }
  }

  if (messages.length === 0) {
    messages.push("All systems operating normally");
  }

  return { level: worst, messages };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

const HEALTH_STYLES: Record<HealthLevel, { bg: string; ring: string; dot: string; text: string; label: string }> = {
  healthy: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-500/30 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Healthy",
  },
  degraded: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    ring: "ring-amber-500/30 dark:ring-amber-400/30",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    label: "Degraded",
  },
  down: {
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-500/30 dark:ring-red-400/30",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    label: "Down",
  },
  unknown: {
    bg: "bg-gray-50 dark:bg-slate-800/50",
    ring: "ring-gray-300 dark:ring-gray-600/30",
    dot: "bg-gray-400",
    text: "text-gray-600 dark:text-gray-300",
    label: "Loading",
  },
};

export default function StatsPage() {
  const { network } = useNetwork();
  const { blockTick, connected: wsConnected } = useBlockSubscription();

  const statusFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getStatus(),
    []
  );
  const chainStatusFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getChainStatus(),
    []
  );
  const blocksFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getBlocks(30),
    []
  );
  const validatorsFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getValidators(),
    []
  );

  const { data: status } = useOnBlock<ChainStatus>(statusFetcher, blockTick);
  const { data: chainStatus } = useOnBlock<RpcChainStatus>(chainStatusFetcher, blockTick);
  const { data: blocks } = useOnBlock<IndexedBlock[]>(blocksFetcher, blockTick);
  const { data: validators } = useOnBlock<ValidatorSetResponse>(validatorsFetcher, blockTick);

  const [genesisTime, setGenesisTime] = useState<number | null>(null);
  useEffect(() => {
    const api = createApi(network);
    api.getBlock(1).then((b) => {
      if (b) setGenesisTime(b.timestamp_ms);
    }).catch(() => {});
  }, [network]);

  const health = computeHealth(blocks, chainStatus, validators);
  const healthStyle = HEALTH_STYLES[health.level];

  const targetBlockTimeMs = chainStatus?.config?.block_time_ms ?? null;
  const blockTimeS = blocks && blocks.length >= 2
    ? (blocks[0].timestamp_ms - blocks[blocks.length - 1].timestamp_ms) / (blocks.length - 1) / 1000
    : null;

  const totalSpanS = blocks && blocks.length >= 2
    ? (blocks[0].timestamp_ms - blocks[blocks.length - 1].timestamp_ms) / 1000
    : 0;
  const totalTxs = blocks ? blocks.reduce((sum, b) => sum + b.tx_count, 0) : 0;
  const tps = totalSpanS > 0 ? totalTxs / totalSpanS : 0;

  const validatorPct = validators && validators.total_count > 0
    ? (validators.active_count / validators.total_count) * 100
    : null;

  const chainId = network.id === "testnet" ? "9000" : network.id === "mainnet" ? "1" : "1337";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Network Status</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live network health for{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">{network.name}</span>
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mb-8 rounded-2xl ${healthStyle.bg} ring-1 ${healthStyle.ring} p-6`}>
        <div className="flex items-start gap-4">
          <span className="relative mt-1.5 flex h-3 w-3 shrink-0">
            {health.level === "healthy" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${healthStyle.dot} opacity-75`} />
            )}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${healthStyle.dot}`} />
          </span>
          <div className="flex-1">
            <div className={`text-xl font-bold ${healthStyle.text}`}>{healthStyle.label}</div>
            <ul className={`mt-1 text-sm ${healthStyle.text} opacity-90 space-y-0.5`}>
              {health.messages.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat
          label="Block Height"
          value={status ? formatNumber(status.latest_height) : "—"}
          sub={chainStatus ? `Finalized ${formatNumber(chainStatus.height)}` : undefined}
        />
        <BigStat
          label="Block Time"
          value={blockTimeS !== null ? `${blockTimeS.toFixed(2)}s` : "—"}
          sub={targetBlockTimeMs !== null ? `Target ${(targetBlockTimeMs / 1000).toFixed(1)}s` : undefined}
        />
        <BigStat
          label="TPS"
          value={tps > 0 ? tps.toFixed(1) : "—"}
          sub="Last 30 blocks"
        />
        <BigStat
          label="Validators"
          value={validators ? `${validators.active_count} / ${validators.total_count}` : "—"}
          sub={validatorPct !== null ? `${validatorPct.toFixed(0)}% active` : undefined}
          progress={validatorPct ?? undefined}
        />
      </div>

      {/* Network details */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Network Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <DetailItem label="Chain ID" value={chainId} />
          <DetailItem label="Network" value={network.name} />
          <DetailItem
            label="Genesis"
            value={genesisTime ? new Date(genesisTime).toLocaleDateString() : "—"}
          />
          <DetailItem
            label="Uptime"
            value={genesisTime ? formatUptime(Date.now() - genesisTime) : "—"}
          />
          <DetailItem
            label="Total Txs"
            value={status ? formatNumber(status.total_txs) : "—"}
          />
          <DetailItem
            label="Mempool"
            value={chainStatus ? formatNumber(chainStatus.pending_ops) : "—"}
          />
        </dl>
      </div>

      {/* Connection indicators */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Connectivity</h2>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <ConnectionRow
            label="WebSocket"
            ok={wsConnected}
            okText="Connected — receiving live blocks"
            failText="Reconnecting (polling fallback active)"
          />
          <ConnectionRow
            label="RPC"
            ok={!!chainStatus}
            okText="Reachable"
            failText="No response"
          />
          <ConnectionRow
            label="Indexer"
            ok={!!status}
            okText="Up to date"
            failText="No response"
          />
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, progress }: { label: string; value: string; sub?: string; progress?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</dd>
    </div>
  );
}

function ConnectionRow({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
      <span className="text-gray-500 dark:text-gray-400">{ok ? okText : failText}</span>
    </div>
  );
}
