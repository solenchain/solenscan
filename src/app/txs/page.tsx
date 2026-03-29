"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/useApi";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { TransactionsTable } from "@/components/TransactionsTable";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function TransactionsPage() {
  const fetcher = useCallback(
    (api: ReturnType<typeof createApi>) => api.getRecentTxs(50),
    []
  );
  const { data: txs, loading, error } = usePolling<IndexedTx[]>(fetcher, 5000);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Transactions</h1>

      {error && <ErrorMessage message={error} />}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {loading && !txs ? (
          <Loading />
        ) : txs && txs.length > 0 ? (
          <TransactionsTable transactions={txs} />
        ) : (
          <p className="py-8 text-center text-gray-400">No transactions found</p>
        )}
      </div>
    </div>
  );
}
