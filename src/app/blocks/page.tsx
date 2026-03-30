"use client";

import { useState, useEffect } from "react";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedBlock, ChainStatus } from "@/lib/types";
import { BlocksTable } from "@/components/BlocksTable";
import { Pagination } from "@/components/Pagination";
import { Loading, ErrorMessage } from "@/components/Loading";

const PAGE_SIZE = 25;

export default function BlocksPage() {
  const { network } = useNetwork();
  const [blocks, setBlocks] = useState<IndexedBlock[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const api = createApi(network);

    async function fetch() {
      try {
        const [data, status] = await Promise.all([
          api.getBlocks(PAGE_SIZE, page * PAGE_SIZE),
          api.getStatus(),
        ]);
        if (mounted) {
          setBlocks(data);
          setTotal(status.total_blocks);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    setLoading(true);
    fetch();
    const id = setInterval(fetch, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [network, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Blocks</h1>

      {error && <ErrorMessage message={error} />}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          {loading && blocks.length === 0 ? (
            <Loading />
          ) : blocks.length > 0 ? (
            <BlocksTable blocks={blocks} />
          ) : (
            <p className="py-8 text-center text-gray-400">No blocks found</p>
          )}
        </div>
        <div className="border-t border-gray-100 px-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hasMore={blocks.length === PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
