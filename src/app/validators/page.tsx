"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePolling } from "@/hooks/useApi";
import { createApi } from "@/lib/api";
import { ValidatorSetResponse } from "@/lib/types";
import { truncateHash, formatBalance, formatNumber } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function ValidatorsPage() {
  const fetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getValidators(),
    []
  );
  const { data, loading, error } = usePolling<ValidatorSetResponse>(fetcher, 5000);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Validators</h1>

      {error && <ErrorMessage message={error} />}

      {/* Summary cards */}
      {data && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Active Validators</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              {data.active_count}
              <span className="text-sm font-normal text-gray-400 ml-1">
                / {data.total_count}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Active Stake</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              {formatBalance(data.total_active_stake)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">SOLEN</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Quorum Threshold</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              2/3+
            </p>
            <p className="text-xs text-gray-400 mt-0.5">stake-weighted BFT</p>
          </div>
        </div>
      )}

      {/* Validators table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="p-6"><Loading /></div>
        ) : data && data.validators.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Validator</th>
                  <th className="px-6 py-3 font-medium">Self Stake</th>
                  <th className="px-6 py-3 font-medium">Delegated</th>
                  <th className="px-6 py-3 font-medium">Stake %</th>
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

                    return (
                      <tr
                        key={v.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-gray-400 font-medium">
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
                              <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                                Genesis
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {formatBalance(v.self_stake || v.stake)} SOLEN
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatBalance(v.delegated || "0")} SOLEN
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 text-xs">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-medium">
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
          <p className="py-8 text-center text-gray-400">No validators found</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
          Active
        </span>
      );
    case "Jailed":
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500" />
          Jailed
        </span>
      );
    case "Exiting":
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-600/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-yellow-500" />
          Exiting
        </span>
      );
    default:
      return <span className="text-gray-500 text-xs">{status}</span>;
  }
}
