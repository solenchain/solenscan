"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedEvent } from "@/lib/types";
import { truncateHash } from "@/lib/utils";
import { Pagination } from "@/components/Pagination";
import { Loading, ErrorMessage } from "@/components/Loading";

const PAGE_SIZE = 25;

export default function EventsPage() {
  const { network } = useNetwork();
  const [events, setEvents] = useState<IndexedEvent[]>([]);
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
          api.getEvents(PAGE_SIZE, page * PAGE_SIZE),
          api.getStatus(),
        ]);
        if (mounted) {
          setEvents(data);
          setTotal(status.total_events);
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Events</h1>

      {error && <ErrorMessage message={error} />}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          {loading && events.length === 0 ? (
            <Loading />
          ) : events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Block</th>
                    <th className="pb-3 pr-4 font-medium">Tx Index</th>
                    <th className="pb-3 pr-4 font-medium">Emitter</th>
                    <th className="pb-3 font-medium">Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, i) => (
                    <tr
                      key={`${event.block_height}-${event.tx_index}-${i}`}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/block/${event.block_height}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {event.block_height}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{event.tx_index}</td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/account/${event.emitter}`}
                          className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                        >
                          {truncateHash(event.emitter)}
                        </Link>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 font-mono text-xs text-purple-700">
                          {event.topic}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-gray-400">No events found</p>
          )}
        </div>
        <div className="border-t border-gray-100 px-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hasMore={events.length === PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
