"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { useBlockSubscription } from "@/hooks/useBlockSubscription";
import { createApi } from "@/lib/api";
import { RpcChainStatus } from "@/lib/types";
import { truncateHash, formatNumber } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

interface Proposal {
  id: number;
  proposer: string;
  action: string;
  description: string;
  status: string;
  voting_end_epoch: number;
  execute_after_epoch: number;
  total_for: string;
  total_against: string;
  vote_count: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20 dark:ring-blue-400/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Voting
        </span>
      );
    case "Passed":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20 dark:ring-green-400/20">
          Passed
        </span>
      );
    case "Rejected":
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20">
          Rejected
        </span>
      );
    case "Executed":
      return (
        <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-900/30 px-2.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-600/20 dark:ring-purple-400/20">
          Executed
        </span>
      );
    default:
      return <span className="text-gray-500 dark:text-gray-400 text-xs">{status}</span>;
  }
}

function parseAction(action: string): string {
  if (action.includes("SetBlockTime")) {
    const match = action.match(/new_block_time_ms:\s*(\d+)/);
    return match ? `Set block time to ${match[1]}ms` : action;
  }
  if (action.includes("SetBaseFee")) {
    const match = action.match(/new_fee:\s*(\d+)/);
    return match ? `Set base fee to ${match[1]}` : action;
  }
  if (action.includes("EmergencyPause")) return "Emergency Pause";
  if (action.includes("EmergencyResume")) return "Emergency Resume";
  return action;
}

export default function GovernancePage() {
  const { network } = useNetwork();
  const { blockTick } = useBlockSubscription();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chainStatus, setChainStatus] = useState<RpcChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const api = createApi(network);

    async function doFetch() {
      try {
        const [props, status] = await Promise.all([
          api.getGovernanceProposals(),
          api.getChainStatus(),
        ]);
        if (mounted) {
          setProposals(props);
          setChainStatus(status);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    doFetch();
    return () => { mounted = false; };
  }, [network, blockTick]);

  const currentEpoch = chainStatus ? Math.floor(chainStatus.height / 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Governance</h1>
        {chainStatus && (
          <span className="text-sm text-gray-500 dark:text-gray-400">Current Epoch: {currentEpoch}</span>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <Loading />
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
          <p className="text-gray-400 dark:text-gray-500 mb-2">No proposals yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Create a proposal via CLI: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">solen propose-block-time</code>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.slice().reverse().map((p) => {
            const totalVotes = BigInt(p.total_for) + BigInt(p.total_against);
            const forPct = totalVotes > BigInt(0)
              ? Number((BigInt(p.total_for) * BigInt(10000)) / totalVotes) / 100
              : 0;
            const isVoting = p.status === "Active";
            const epochsLeft = isVoting ? Math.max(0, p.voting_end_epoch - currentEpoch) : 0;
            const canFinalize = isVoting && currentEpoch > p.voting_end_epoch;
            const canExecute = p.status === "Passed" && currentEpoch >= p.execute_after_epoch;

            return (
              <div
                key={p.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Proposal #{p.id}
                      </span>
                      {statusBadge(p.status)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400 dark:text-gray-500">
                    <div>Proposed by{" "}
                      <Link href={`/account/${p.proposer}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                        {truncateHash(p.proposer, 6)}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="mb-4 rounded-lg bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-gray-700 p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Action:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{parseAction(p.action)}</p>
                </div>

                {/* Votes */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{p.vote_count} vote{p.vote_count !== 1 ? "s" : ""}</span>
                    <span>
                      For: {formatNumber(Number(BigInt(p.total_for) / BigInt(100000000)))} SOLEN
                      {" / "}
                      Against: {formatNumber(Number(BigInt(p.total_against) / BigInt(100000000)))} SOLEN
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3 flex overflow-hidden">
                    {totalVotes > BigInt(0) && (
                      <>
                        <div
                          className="bg-green-500 h-3"
                          style={{ width: `${forPct}%` }}
                        />
                        <div
                          className="bg-red-400 h-3"
                          style={{ width: `${100 - forPct}%` }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-green-600">{forPct.toFixed(1)}% For</span>
                    <span className="text-red-500">{(100 - forPct).toFixed(1)}% Against</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {isVoting && !canFinalize && (
                    <span className="text-blue-600">
                      {epochsLeft} epoch{epochsLeft !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                  {canFinalize && (
                    <span className="text-orange-600 font-medium">
                      Ready to finalize
                    </span>
                  )}
                  {canExecute && (
                    <span className="text-purple-600 font-medium">
                      Ready to execute
                    </span>
                  )}
                  {p.status === "Executed" && (
                    <span className="text-purple-600">Executed</span>
                  )}
                  <span>Voting ends: epoch {p.voting_end_epoch}</span>
                  <span>Timelock: epoch {p.execute_after_epoch}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
