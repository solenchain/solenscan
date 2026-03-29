"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatGas, formatBalance, getTransferInfo } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function TxDetailPage() {
  const params = useParams();
  const blockHeight = Number(params.height);
  const txIndex = Number(params.index);
  const { network } = useNetwork();

  const [tx, setTx] = useState<IndexedTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mounted = { current: true };

    async function fetchTx() {
      try {
        const api = createApi(network);
        const result = await api.getTx(blockHeight, txIndex);
        if (mounted.current) {
          setTx(result);
          setError(null);
        }
      } catch (e) {
        if (mounted.current) {
          setError(e instanceof Error ? e.message : "Transaction not found");
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    setLoading(true);
    fetchTx();
    return () => { mounted.current = false; };
  }, [network, blockHeight, txIndex]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8"><Loading /></div>;
  if (error || !tx) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <ErrorMessage message={error || "Transaction not found"} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Transaction Details
      </h1>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
        <Row label="Status">
          {tx.success ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-sm font-medium text-green-700 ring-1 ring-green-600/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500" />
              Success
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-sm font-medium text-red-700 ring-1 ring-red-600/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-red-500" />
              Failed
            </span>
          )}
        </Row>
        <Row label="Block">
          <Link
            href={`/block/${tx.block_height}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {formatNumber(tx.block_height)}
          </Link>
        </Row>
        <Row label="Transaction Index" value={tx.index.toString()} />
        <Row label="From">
          <Link
            href={`/account/${tx.sender}`}
            className="text-indigo-600 hover:text-indigo-800 font-mono text-sm"
          >
            {tx.sender}
          </Link>
          <CopyButton text={tx.sender} />
        </Row>
        {(() => {
          const transfer = getTransferInfo(tx.events);
          if (!transfer) return null;
          return (
            <>
              <Row label="To">
                <Link
                  href={`/account/${transfer.to}`}
                  className="text-indigo-600 hover:text-indigo-800 font-mono text-sm"
                >
                  {transfer.to}
                </Link>
                <CopyButton text={transfer.to} />
              </Row>
              <Row label="Value">
                <span className="text-lg font-semibold text-gray-900">
                  {formatBalance(transfer.amount)} SOL
                </span>
                <span className="ml-2 text-xs text-gray-400">(raw: {transfer.amount})</span>
              </Row>
            </>
          );
        })()}
        <Row label="Nonce" value={formatNumber(tx.nonce)} />
        <Row label="Gas Used" value={`${formatNumber(tx.gas_used)} (${formatGas(tx.gas_used)})`} />
        {tx.error && (
          <Row label="Error">
            <span className="text-red-600 font-mono text-sm">{tx.error}</span>
          </Row>
        )}
      </div>

      {/* Events */}
      {tx.events.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-semibold text-gray-900">
              Events ({tx.events.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {tx.events.map((event, i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {event.topic}
                      </span>
                      <span className="text-xs text-gray-400">Event #{i}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Emitter:</span>
                      <Link
                        href={`/account/${event.emitter}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                      >
                        {truncateHash(event.emitter, 10)}
                      </Link>
                      <CopyButton text={event.emitter} />
                    </div>
                  </div>
                  <Link
                    href={`/block/${event.block_height}`}
                    className="text-xs text-gray-400 shrink-0"
                  >
                    Block #{formatNumber(event.block_height)}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row border-b border-gray-100 last:border-0">
      <div className="px-6 py-3.5 text-sm font-medium text-gray-500 sm:w-48 bg-gray-50/50">
        {label}
      </div>
      <div className="px-6 py-3.5 text-sm text-gray-900 flex-1 flex items-center gap-1">
        {value || children}
      </div>
    </div>
  );
}
