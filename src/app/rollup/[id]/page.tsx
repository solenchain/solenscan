"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { RollupDetail, IndexedBatch } from "@/lib/types";
import { truncateHash, formatNumber } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function RollupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { network } = useNetwork();
  const [rollup, setRollup] = useState<RollupDetail | null>(null);
  const [batches, setBatches] = useState<IndexedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rollupId = parseInt(id, 10);

  useEffect(() => {
    const api = createApi(network);
    setLoading(true);
    setError(null);

    Promise.all([
      api.getRollup(rollupId),
      api.getRollupBatches(rollupId, 50),
    ])
      .then(([detail, batchList]) => {
        setRollup(detail);
        setBatches(batchList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [network, rollupId]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8"><Loading /></div>;
  if (error) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorMessage message={error} /></div>;
  if (!rollup) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ErrorMessage message={`Rollup #${rollupId} not found`} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/rollups" className="hover:text-indigo-600">Rollups</Link>
          <span>/</span>
          <span>#{rollup.rollup_id}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
            #{rollup.rollup_id}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rollup.name}</h1>
            <p className="text-sm text-gray-500">Rollup Domain</p>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <InfoCard label="Proof Type" value={rollup.proof_type || "unknown"} />
        <InfoCard label="Total Batches" value={formatNumber(rollup.total_batches)} />
        <InfoCard label="Registered" value={`Block #${formatNumber(rollup.registered_at_height)}`} />
        <InfoCard
          label="Latest State Root"
          value={
            rollup.latest_batch
              ? truncateHash(rollup.latest_batch.state_root, 10)
              : "genesis"
          }
          mono
        />
      </div>

      {/* Sequencer */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Sequencer</h2>
        <Link
          href={`/account/${rollup.sequencer}`}
          className="font-mono text-sm text-indigo-600 hover:text-indigo-800 break-all"
        >
          {rollup.sequencer}
        </Link>
      </div>

      {/* Batch history */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Batch History</h2>
        </div>

        {batches.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No batches submitted yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Block</th>
                  <th className="px-5 py-3">State Root</th>
                  <th className="px-5 py-3">Data Hash</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batches.map((b) => (
                  <tr key={b.batch_index} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      #{formatNumber(b.batch_index)}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/block/${b.block_height}`} className="text-indigo-600 hover:text-indigo-800">
                        #{formatNumber(b.block_height)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {truncateHash(b.state_root, 10)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {truncateHash(b.data_hash, 10)}
                    </td>
                    <td className="px-5 py-3">
                      {b.verified ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-600/20">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-semibold text-gray-900 ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </div>
    </div>
  );
}
