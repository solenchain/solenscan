"use client";

import Link from "next/link";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatGas, formatBalance, getTransferInfo } from "@/lib/utils";

interface TransactionsTableProps {
  transactions: IndexedTx[];
  compact?: boolean;
}

export function TransactionsTable({ transactions, compact }: TransactionsTableProps) {
  if (compact) {
    return (
      <div className="divide-y divide-gray-100">
        {transactions.map((tx) => {
          const transfer = getTransferInfo(tx.events);
          return (
            <div
              key={`${tx.block_height}-${tx.index}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 px-1 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-mono ${
                  tx.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}>
                  Tx
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/tx/${tx.block_height}/${tx.index}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      #{formatNumber(tx.block_height)}-{tx.index}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>From</span>
                    <Link
                      href={`/account/${tx.sender}`}
                      className="hover:text-indigo-600 font-mono"
                    >
                      {truncateHash(tx.sender, 4)}
                    </Link>
                    {transfer && (
                      <>
                        <span>To</span>
                        <Link
                          href={`/account/${transfer.to}`}
                          className="hover:text-indigo-600 font-mono"
                        >
                          {truncateHash(transfer.to, 4)}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {transfer && (
                  <p className="text-sm font-medium text-gray-900">
                    {formatBalance(transfer.amount)} SOLEN
                  </p>
                )}
                {tx.success ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                    Success
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
                    Failed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 pr-4 font-medium">Txn</th>
            <th className="pb-3 pr-4 font-medium">Block</th>
            <th className="pb-3 pr-4 font-medium">From</th>
            <th className="pb-3 pr-4 font-medium">To</th>
            <th className="pb-3 pr-4 font-medium">Amount</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Gas Used</th>
            <th className="pb-3 font-medium">Events</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const transfer = getTransferInfo(tx.events);
            return (
              <tr
                key={`${tx.block_height}-${tx.index}`}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/tx/${tx.block_height}/${tx.index}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {tx.block_height}-{tx.index}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/block/${tx.block_height}`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    {formatNumber(tx.block_height)}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/account/${tx.sender}`}
                    className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                  >
                    {truncateHash(tx.sender)}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  {transfer ? (
                    <Link
                      href={`/account/${transfer.to}`}
                      className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                    >
                      {truncateHash(transfer.to)}
                    </Link>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {transfer ? (
                    <span>{formatBalance(transfer.amount)} SOLEN</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {tx.success ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                      Success
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20"
                      title={tx.error || undefined}
                    >
                      Failed
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-600">
                  {formatGas(tx.gas_used)}
                </td>
                <td className="py-3 text-gray-600">
                  {tx.events.length > 0 && (
                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {tx.events.length}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
