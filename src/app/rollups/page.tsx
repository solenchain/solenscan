"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedRollup } from "@/lib/types";
import { truncateHash, formatNumber } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function RollupsPage() {
  const { network } = useNetwork();
  const [rollups, setRollups] = useState<IndexedRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = createApi(network);
    setLoading(true);
    setError(null);
    api
      .getRollups()
      .then(setRollups)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [network]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rollups</h1>
        <p className="mt-1 text-sm text-gray-500">
          Registered rollup domains on the Solen settlement layer
        </p>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && rollups.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No rollups registered yet
        </div>
      )}

      {!loading && rollups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rollups.map((r) => (
            <Link
              key={r.rollup_id}
              href={`/rollup/${r.rollup_id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 text-sm font-bold">
                    #{r.rollup_id}
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                    {r.name || `Rollup #${r.rollup_id}`}
                  </h3>
                </div>
                {r.proof_type && (
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-600/20">
                    {r.proof_type}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Sequencer</span>
                  <span className="font-mono text-gray-700">{truncateHash(r.sequencer)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registered</span>
                  <span className="text-gray-700">Block #{formatNumber(r.registered_at_height)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
