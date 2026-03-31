"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/hooks/useApi";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { ChainStatus, RpcChainStatus, IndexedBlock, IndexedTx, ValidatorSetResponse } from "@/lib/types";
import { formatNumber, formatBalance } from "@/lib/utils";
import { resolveSearch } from "@/components/SearchBar";
import { StatCard } from "@/components/StatCard";
import { BlocksTable } from "@/components/BlocksTable";
import { TransactionsTable } from "@/components/TransactionsTable";
import { Loading, ErrorMessage } from "@/components/Loading";

function useTps(blocks: IndexedBlock[] | null) {
  const [tps, setTps] = useState<string>("0");
  const prevRef = useRef<{ height: number; time: number } | null>(null);

  useEffect(() => {
    if (!blocks || blocks.length < 2) return;
    const latest = blocks[0];
    const prev = prevRef.current;

    if (prev && latest.height !== prev.height) {
      const timeDiff = (latest.timestamp_ms - prev.time) / 1000;
      if (timeDiff > 0) {
        let totalTxs = 0;
        for (const b of blocks) {
          if (b.height > prev.height) totalTxs += b.tx_count;
          else break;
        }
        setTps((totalTxs / timeDiff).toFixed(1));
      }
    }
    prevRef.current = { height: latest.height, time: latest.timestamp_ms };
  }, [blocks]);

  return tps;
}

export default function HomePage() {
  const { network } = useNetwork();

  const statusFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getStatus(),
    []
  );
  const chainStatusFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getChainStatus(),
    []
  );
  const blocksFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getBlocks(10),
    []
  );
  const txsFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getRecentTxs(8),
    []
  );
  const validatorsFetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getValidators(),
    []
  );

  const { data: status, error: statusError } = usePolling<ChainStatus>(statusFetcher);
  const { data: chainStatus } = usePolling<RpcChainStatus>(chainStatusFetcher);
  const { data: blocks, loading: blocksLoading, error: blocksError } = usePolling<IndexedBlock[]>(blocksFetcher);
  const { data: txs } = usePolling<IndexedTx[]>(txsFetcher);
  const { data: validators } = usePolling<ValidatorSetResponse>(validatorsFetcher);

  const tps = useTps(blocks);
  const error = statusError || blocksError;

  const epoch = blocks && blocks.length > 0 ? blocks[0].epoch : null;
  const blockTime = blocks && blocks.length >= 2
    ? ((blocks[0].timestamp_ms - blocks[blocks.length - 1].timestamp_ms) / (blocks.length - 1) / 1000).toFixed(1)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      {/* Hero search section */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 sm:p-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">
              Solen Blockchain Explorer
            </h1>
            <p className="text-indigo-200 text-sm mb-4">
              Search blocks, transactions, accounts, and events on{" "}
              <span className="font-medium text-white">{network.name}</span>
            </p>
            <div className="relative max-w-xl">
              <input
                type="text"
                placeholder="Search by block height, account ID, or transaction..."
                className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/20 px-4 py-3 text-sm text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = (e.target as HTMLInputElement).value.trim();
                    if (!q) return;
                    window.location.href = resolveSearch(q);
                  }
                }}
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {chainStatus && chainStatus.total_allocation !== "0" && (
            <div className="flex flex-row lg:flex-col gap-3 lg:gap-2 lg:text-right">
              <div>
                <div className="text-indigo-200 text-[10px] uppercase tracking-wide">Total Allocation</div>
                <div className="text-sm font-semibold">
                  {formatBalance(chainStatus.total_allocation)} <span className="text-xs font-normal text-indigo-200">SOLEN</span>
                </div>
              </div>
              <div>
                <div className="text-indigo-200 text-[10px] uppercase tracking-wide">Total Staked</div>
                <div className="text-sm font-semibold">
                  {formatBalance(chainStatus.total_staked)} <span className="text-xs font-normal text-indigo-200">SOLEN</span>
                </div>
              </div>
              <div>
                <div className="text-indigo-200 text-[10px] uppercase tracking-wide">Circulating Supply</div>
                <div className="text-sm font-semibold">
                  {formatBalance(chainStatus.total_circulation)} <span className="text-xs font-normal text-indigo-200">SOLEN</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Block Height"
          value={status ? formatNumber(status.latest_height) : "-"}
          icon={<BlockIcon />}
        />
        <StatCard
          label="Epoch"
          value={epoch !== null ? epoch.toString() : "-"}
          subValue={blockTime ? `~${blockTime}s block time` : undefined}
          icon={<EpochIcon />}
        />
        <StatCard
          label="TPS"
          value={tps}
          subValue="transactions/sec"
          icon={<SpeedIcon />}
        />
        <StatCard
          label="Transactions"
          value={status ? formatNumber(status.total_txs) : "-"}
          icon={<TxIcon />}
        />
        <StatCard
          label="Validators"
          value={validators ? `${validators.active_count}` : "-"}
          subValue={validators ? `${validators.total_count} total` : undefined}
          icon={<ValidatorIcon />}
        />
        <StatCard
          label="Pending"
          value={chainStatus ? formatNumber(chainStatus.pending_ops) : "-"}
          subValue="in mempool"
          icon={<PendingIcon />}
        />
      </div>

      {/* Latest blocks & events side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Latest Blocks</h2>
            <Link
              href="/blocks"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="px-4 pb-2">
            {blocksLoading && !blocks ? (
              <Loading />
            ) : blocks && blocks.length > 0 ? (
              <BlocksTable blocks={blocks.slice(0, 8)} compact />
            ) : (
              <p className="py-8 text-center text-gray-400">No blocks yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Latest Transactions</h2>
            <Link
              href="/txs"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="px-4 pb-2">
            {txs && txs.length > 0 ? (
              <TransactionsTable transactions={txs.slice(0, 8)} compact />
            ) : (
              <p className="py-8 text-center text-gray-400">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Chain overview card */}
      {chainStatus && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Chain Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">State Root</span>
              <p className="font-mono text-xs text-gray-700 mt-1 break-all">
                {chainStatus.latest_state_root}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Finalized Height</span>
              <p className="font-semibold text-gray-900 mt-1">
                {formatNumber(chainStatus.height)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Mempool</span>
              <p className="font-semibold text-gray-900 mt-1">
                {formatNumber(chainStatus.pending_ops)} pending operations
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function EpochIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function TxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function ValidatorIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
