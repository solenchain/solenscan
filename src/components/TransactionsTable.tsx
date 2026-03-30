"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatGas, formatBalance, getTransferInfo, parseRewardEvent, parseStakeEvent } from "@/lib/utils";

// Global cache for token symbols.
const tokenSymbolCache: Record<string, string> = {};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function TokenAmount({ transfer }: { transfer: { amount: string; tokenContract?: string } }) {
  const { network } = useNetwork();
  const [symbol, setSymbol] = useState(
    transfer.tokenContract ? tokenSymbolCache[transfer.tokenContract] || "" : ""
  );

  useEffect(() => {
    if (!transfer.tokenContract) return;
    if (tokenSymbolCache[transfer.tokenContract]) {
      setSymbol(tokenSymbolCache[transfer.tokenContract]);
      return;
    }
    const api = createApi(network);
    api.callView(transfer.tokenContract, "symbol").then((res) => {
      if (res.success) {
        const sym = new TextDecoder().decode(hexToBytes(res.return_data));
        tokenSymbolCache[transfer.tokenContract!] = sym;
        setSymbol(sym);
      }
    }).catch(() => {});
  }, [transfer.tokenContract, network]);

  if (transfer.tokenContract) {
    return <>{formatNumber(Number(transfer.amount))} {symbol || "tokens"}</>;
  }
  return <>{formatBalance(transfer.amount)} SOLEN</>;
}

interface TransactionsTableProps {
  transactions: IndexedTx[];
  compact?: boolean;
  /** If set, only show reward amounts for this specific account. */
  accountFilter?: string;
}

export function TransactionsTable({ transactions, compact, accountFilter }: TransactionsTableProps) {
  if (compact) {
    return (
      <div className="divide-y divide-gray-100">
        {transactions.map((tx) => {
          const transfer = getTransferInfo(tx.events, tx.sender);

          // Sum reward events. If accountFilter is set, only sum events for that account.
          const rewardEvents = tx.events.filter((e) => e.topic === "epoch_reward" || e.topic === "delegator_reward");
          const filteredRewardEvents = accountFilter
            ? rewardEvents.filter((e) => {
                const parsed = parseRewardEvent(e.data);
                return parsed && parsed.validator === accountFilter;
              })
            : rewardEvents;
          const totalRewardAmount = filteredRewardEvents.reduce((sum, e) => {
            const parsed = parseRewardEvent(e.data);
            return sum + (parsed ? BigInt(parsed.amount) : BigInt(0));
          }, BigInt(0));
          const isReward = filteredRewardEvents.length > 0 || (rewardEvents.length > 0 && !accountFilter);
          const reward = isReward && totalRewardAmount > BigInt(0) ? { validator: "", amount: totalRewardAmount.toString() } : null;
          const rewardCount = accountFilter ? filteredRewardEvents.length : rewardEvents.length;

          const stakeEvent = tx.events.find((e) => e.topic === "delegate" || e.topic === "undelegate");
          const stake = stakeEvent ? parseStakeEvent(stakeEvent.data) : null;
          const isStake = stake !== null;
          const isDelegate = stakeEvent?.topic === "delegate";
          return (
            <div
              key={`${tx.block_height}-${tx.index}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 px-1 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-mono ${
                  isReward
                    ? "bg-amber-50 text-amber-600"
                    : transfer?.tokenContract
                      ? "bg-purple-50 text-purple-600"
                      : tx.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}>
                  {isReward ? "⛏" : transfer?.tokenContract ? "TK" : "Tx"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/tx/${tx.block_height}/${tx.index}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      #{formatNumber(tx.block_height)}-{tx.index}
                    </Link>
                    {isReward && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Reward
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    {isReward ? (
                      <>
                        <span className="text-amber-600">Epoch Rewards · {rewardCount} payouts</span>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {transfer && (
                  <p className={`text-sm font-medium ${transfer.tokenContract ? "text-purple-700" : "text-gray-900"}`}>
                    <TokenAmount transfer={transfer} />
                  </p>
                )}
                {reward && (
                  <div>
                    <p className="text-sm font-medium text-amber-700">
                      +{formatBalance(reward.amount)} SOLEN
                    </p>
                    {rewardCount > 1 && (
                      <p className="text-xs text-gray-400">{rewardCount} payouts</p>
                    )}
                  </div>
                )}
                {stake && (
                  <p className={`text-sm font-medium ${isDelegate ? "text-blue-700" : "text-orange-700"}`}>
                    {isDelegate ? "Stake " : "Unstake "}{formatBalance(stake.amount)} SOLEN
                  </p>
                )}
                {!isReward && !isStake && (tx.success ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                    Success
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
                    Failed
                  </span>
                ))}
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
            const transfer = getTransferInfo(tx.events, tx.sender);

            const rewardEvents = tx.events.filter((e) => e.topic === "epoch_reward" || e.topic === "delegator_reward");
            const filteredRewardEvents = accountFilter
              ? rewardEvents.filter((e) => {
                  const parsed = parseRewardEvent(e.data);
                  return parsed && parsed.validator === accountFilter;
                })
              : rewardEvents;
            const totalRewardAmount = filteredRewardEvents.reduce((sum, e) => {
              const parsed = parseRewardEvent(e.data);
              return sum + (parsed ? BigInt(parsed.amount) : BigInt(0));
            }, BigInt(0));
            const reward = totalRewardAmount > BigInt(0) ? { validator: "", amount: totalRewardAmount.toString() } : null;
            const rewardCount = filteredRewardEvents.length;

            const stakeEvent = tx.events.find((e) => e.topic === "delegate" || e.topic === "undelegate");
            const stake = stakeEvent ? parseStakeEvent(stakeEvent.data) : null;
            const isDelegate = stakeEvent?.topic === "delegate";
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
                  {reward ? (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Staking Pool
                    </span>
                  ) : (
                    <Link
                      href={`/account/${tx.sender}`}
                      className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                    >
                      {truncateHash(tx.sender)}
                    </Link>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {reward ? (
                    accountFilter ? (
                      <Link
                        href={`/account/${accountFilter}`}
                        className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                      >
                        {truncateHash(accountFilter)}
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-600">{rewardCount} recipients</span>
                    )
                  ) : transfer ? (
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
                <td className="py-3 pr-4 font-medium">
                  {reward ? (
                    <span className="text-amber-700" title={`${rewardCount} payouts`}>+{formatBalance(reward.amount)} SOLEN</span>
                  ) : transfer ? (
                    <span className={transfer.tokenContract ? "text-purple-700" : "text-gray-900"}>
                      <TokenAmount transfer={transfer} />
                    </span>
                  ) : stake ? (
                    <span className={isDelegate ? "text-blue-700" : "text-orange-700"}>
                      {isDelegate ? "Stake " : "Unstake "}{formatBalance(stake.amount)} SOLEN
                    </span>
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
