"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { useBlockSubscription } from "@/hooks/useBlockSubscription";
import { createApi } from "@/lib/api";
import { IntentInfo } from "@/lib/types";
import { truncateHash, formatNumber, formatBalance } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

interface FulfilledIntent {
  intent_id: number;
  sender: string;
  block_height: number;
  tx_index: number;
  transfer_to: string | null;
  transfer_amount: string | null;
  solver_tip: string | null;
  solver: string | null;
}

export default function IntentsPage() {
  const { network } = useNetwork();
  const { blockTick } = useBlockSubscription();
  const [pending, setPending] = useState<IntentInfo[]>([]);
  const [fulfilled, setFulfilled] = useState<FulfilledIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "fulfilled">("pending");

  useEffect(() => {
    const api = createApi(network);
    setLoading(true);
    setError(null);

    Promise.all([
      api.getPendingIntents(50).catch(() => [] as IntentInfo[]),
      api.getFulfilledIntents(50).catch(() => [] as FulfilledIntent[]),
    ])
      .then(([p, f]) => {
        setPending(p);
        setFulfilled(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {};
  }, [network, blockTick]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Intents</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Intent-based execution — users express desired outcomes, solvers compete to fulfill them
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">{pending.length}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">awaiting solvers</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fulfilled</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">{fulfilled.length}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">completed</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Tips Paid</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatBalance(
              fulfilled
                .reduce((sum, i) => sum + BigInt(i.solver_tip || "0"), BigInt(0))
                .toString()
            )}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SOLEN</p>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {!loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50">
            <div className="flex gap-0">
              <button
                onClick={() => setTab("pending")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  tab === "pending"
                    ? "border-b-2 border-cyan-600 text-cyan-600 bg-white dark:bg-slate-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Pending ({pending.length})
              </button>
              <button
                onClick={() => setTab("fulfilled")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  tab === "fulfilled"
                    ? "border-b-2 border-cyan-600 text-cyan-600 bg-white dark:bg-slate-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Fulfilled ({fulfilled.length})
              </button>
            </div>
          </div>

          {tab === "pending" && (
            pending.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No pending intents — all intents have been fulfilled or expired
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Sender</th>
                      <th className="px-5 py-3">Constraints</th>
                      <th className="px-5 py-3">Tip</th>
                      <th className="px-5 py-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {pending.map((intent) => (
                      <tr key={intent.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">#{intent.id}</td>
                        <td className="px-5 py-3">
                          <Link href={`/account/${intent.sender}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-xs">
                            {truncateHash(intent.sender)}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {intent.constraints.map((c, i) => (
                              <span key={i} className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-600/20 dark:ring-cyan-400/20">
                                {c.type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-cyan-700 font-medium">
                          {formatBalance(intent.tip)} SOLEN
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          Block #{formatNumber(intent.expiry_height)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === "fulfilled" && (
            fulfilled.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No fulfilled intents yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Block</th>
                      <th className="px-5 py-3">From</th>
                      <th className="px-5 py-3">To</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Solver Tip</th>
                      <th className="px-5 py-3">Solver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {fulfilled.map((intent) => (
                      <tr key={intent.intent_id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="px-5 py-3">
                          <Link href={`/tx/${intent.block_height}/${intent.tx_index}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                            #{intent.intent_id}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/block/${intent.block_height}`} className="text-indigo-600 hover:text-indigo-800">
                            #{formatNumber(intent.block_height)}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/account/${intent.sender}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-xs">
                            {truncateHash(intent.sender)}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          {intent.transfer_to ? (
                            <Link href={`/account/${intent.transfer_to}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-xs">
                              {truncateHash(intent.transfer_to)}
                            </Link>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {intent.transfer_amount ? `${formatBalance(intent.transfer_amount)} SOLEN` : "-"}
                        </td>
                        <td className="px-5 py-3 text-cyan-700 font-medium">
                          {intent.solver_tip ? `${formatBalance(intent.solver_tip)} SOLEN` : "-"}
                        </td>
                        <td className="px-5 py-3">
                          {intent.solver ? (
                            <Link href={`/account/${intent.solver}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-xs">
                              {truncateHash(intent.solver)}
                            </Link>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
