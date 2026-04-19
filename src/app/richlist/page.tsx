"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { truncateHash, formatBalance } from "@/lib/utils";
import { Loading, ErrorMessage } from "@/components/Loading";

interface RichListEntry {
  rank: number;
  address: string;
  balance: string;
  staked: string;
  total: string;
}

export default function RichListPage() {
  const { network } = useNetwork();
  const [entries, setEntries] = useState<RichListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const api = createApi(network);

    async function doFetch() {
      try {
        const data = await api.getRichList(100, 0);
        if (mounted) {
          setEntries(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load rich list");
          setLoading(false);
        }
      }
    }

    doFetch();
    return () => { mounted = false; };
  }, [network]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rich List</h1>
      <p className="text-sm text-gray-400">Top accounts by total holdings (balance + staked)</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="py-3 px-2 w-16">#</th>
              <th className="py-3 px-2">Address</th>
              <th className="py-3 px-2 text-right">Balance</th>
              <th className="py-3 px-2 text-right">Staked</th>
              <th className="py-3 px-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.address} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3 px-2 text-gray-400">{entry.rank}</td>
                <td className="py-3 px-2">
                  <Link
                    href={`/account/${entry.address}`}
                    className="text-emerald-400 hover:underline font-mono text-xs"
                  >
                    <span className="hidden sm:inline">{entry.address}</span>
                    <span className="sm:hidden">{truncateHash(entry.address)}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {formatBalance(entry.balance)}
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {BigInt(entry.staked) > 0n ? (
                    <span className="text-yellow-400">{formatBalance(entry.staked)}</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right font-mono font-semibold">
                  {formatBalance(entry.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
