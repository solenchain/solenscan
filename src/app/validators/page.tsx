"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { useBlockSubscription } from "@/hooks/useBlockSubscription";
import { createApi } from "@/lib/api";
import { ValidatorSetResponse } from "@/lib/types";
import { truncateHash, formatBalance, formatNumber } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

interface ValidatorStat {
  validator: string;
  blocks_proposed: number;
  last_proposed_height: number;
  uptime_pct: number;
}

export default function ValidatorsPage() {
  const { network } = useNetwork();
  const { blockTick } = useBlockSubscription();
  const [data, setData] = useState<ValidatorSetResponse | null>(null);
  const [stats, setStats] = useState<Record<string, ValidatorStat>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const api = createApi(network);

    async function doFetch() {
      try {
        const [validators, validatorStats] = await Promise.all([
          api.getValidators(),
          api.getValidatorStats().catch(() => [] as ValidatorStat[]),
        ]);
        if (mounted) {
          setData(validators);
          const statsMap: Record<string, ValidatorStat> = {};
          for (const s of validatorStats) {
            statsMap[s.validator] = s;
          }
          setStats(statsMap);
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Validators</h1>

      {error && <ErrorMessage message={error} />}

      {/* Summary cards */}
      {data && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active Validators</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {data.active_count}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">
                / {data.total_count}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Active Stake</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatBalance(data.total_active_stake)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SOLEN</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quorum Threshold</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              2/3+
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">stake-weighted BFT</p>
          </div>
        </div>
      )}

      {/* Validators table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="p-6"><Loading /></div>
        ) : data && data.validators.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Validator</th>
                  <th className="px-6 py-3 font-medium">Self Stake</th>
                  <th className="px-6 py-3 font-medium">Stake %</th>
                  <th className="px-6 py-3 font-medium">Blocks</th>
                  <th className="px-6 py-3 font-medium">Block Share</th>
                  <th className="px-6 py-3 font-medium">Commission</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.validators
                  .slice()
                  .sort((a, b) => {
                    const stakeA = BigInt(a.stake);
                    const stakeB = BigInt(b.stake);
                    if (stakeB > stakeA) return 1;
                    if (stakeB < stakeA) return -1;
                    return 0;
                  })
                  .map((v, i) => {
                    const totalStake = BigInt(data.total_active_stake);
                    const stake = BigInt(v.stake);
                    const pct = totalStake > BigInt(0)
                      ? Number((stake * BigInt(10000)) / totalStake) / 100
                      : 0;
                    const stat = stats[v.id];

                    return (
                      <tr
                        key={v.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <td className="px-6 py-4 text-gray-400 dark:text-gray-500 font-medium">
                          {i + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/account/${v.id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                            >
                              {truncateHash(v.id, 10)}
                            </Link>
                            {v.is_genesis && (
                              <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                                Genesis
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                          {formatBalance(v.self_stake || v.stake)} SOLEN
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 dark:text-gray-400 text-xs">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                          {stat ? formatNumber(stat.blocks_proposed) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {stat ? (() => {
                            // Expected block share is proportional to stake weight, not equal split
                            const expected = pct;
                            const ratio = expected > 0 ? stat.uptime_pct / expected : 0;
                            const color = ratio > 0.8 ? "bg-green-500" : ratio > 0.5 ? "bg-yellow-500" : "bg-red-500";
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${color}`}
                                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-gray-600 dark:text-gray-400 text-xs">
                                  {stat.uptime_pct.toFixed(1)}%
                                  <span className="text-gray-400 dark:text-gray-500 ml-0.5">/ {expected.toFixed(1)}%</span>
                                </span>
                              </div>
                            );
                          })() : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">
                          {v.commission_pct || "10.0%"}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={v.status} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-gray-400 dark:text-gray-500">No validators found</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20 dark:ring-green-400/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
          Active
        </span>
      );
    case "Jailed":
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500" />
          Jailed
        </span>
      );
    case "Exiting":
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-50 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-600/20 dark:ring-yellow-400/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-yellow-500" />
          Exiting
        </span>
      );
    default:
      return <span className="text-gray-500 dark:text-gray-400 text-xs">{status}</span>;
  }
}
