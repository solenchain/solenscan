"use client";

import Link from "next/link";
import { IndexedBlock } from "@/lib/types";
import { truncateHash, timeAgo, formatNumber, formatGas } from "@/lib/utils";

interface BlocksTableProps {
  blocks: IndexedBlock[];
  compact?: boolean;
}

export function BlocksTable({ blocks, compact }: BlocksTableProps) {
  if (compact) {
    return (
      <div className="divide-y divide-gray-100">
        {blocks.map((block) => (
          <div key={block.height} className="flex items-center justify-between py-3 hover:bg-gray-50 px-1 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-xs font-mono">
                Bk
              </div>
              <div>
                <Link
                  href={`/block/${block.height}`}
                  className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                >
                  #{formatNumber(block.height)}
                </Link>
                <p className="text-xs text-gray-400">{timeAgo(block.timestamp_ms)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center hidden sm:block">
                <p className="text-xs text-gray-600">{block.epoch}</p>
                <p className="text-[10px] text-gray-400">epoch</p>
              </div>
              <div className="text-center">
                <Link
                  href={`/account/${block.proposer}`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                >
                  {truncateHash(block.proposer, 6)}
                </Link>
                <p className="text-[10px] text-gray-400">proposer</p>
              </div>
              <div className="text-center min-w-[32px]">
                <p className="text-xs text-gray-600">{block.tx_count}</p>
                <p className="text-[10px] text-gray-400">txns</p>
              </div>
              <div className="text-right min-w-[40px] hidden sm:block">
                <p className="text-xs text-gray-600">{formatGas(block.gas_used)}</p>
                <p className="text-[10px] text-gray-400">gas</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 pr-4 font-medium">Block</th>
            <th className="pb-3 pr-4 font-medium">Epoch</th>
            <th className="pb-3 pr-4 font-medium">Age</th>
            <th className="pb-3 pr-4 font-medium">Txns</th>
            <th className="pb-3 pr-4 font-medium">Gas Used</th>
            <th className="pb-3 font-medium">Proposer</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr
              key={block.height}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/block/${block.height}`}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {formatNumber(block.height)}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-600">{block.epoch}</td>
              <td className="py-3 pr-4 text-gray-600">
                {timeAgo(block.timestamp_ms)}
              </td>
              <td className="py-3 pr-4">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {block.tx_count}
                </span>
              </td>
              <td className="py-3 pr-4 text-gray-600">
                {formatGas(block.gas_used)}
              </td>
              <td className="py-3">
                <Link
                  href={`/account/${block.proposer}`}
                  className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                >
                  {truncateHash(block.proposer)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
