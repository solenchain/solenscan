"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatGas, formatBalance, getTransferInfo, parseRewardEvent, parseStakeEvent, parseSlashEvent, hexToBase58 } from "@/lib/utils";

// Global cache for token symbols and decimals.
const tokenSymbolCache: Record<string, string> = {};
const tokenDecimalsCache: Record<string, number> = {};

function formatTokenBalance(raw: string, decimals: number): string {
  const n = BigInt(raw);
  if (decimals === 0) return n.toLocaleString();
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  if (frac === BigInt(0)) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

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
  const [decimals, setDecimals] = useState(
    transfer.tokenContract ? tokenDecimalsCache[transfer.tokenContract] ?? 8 : 8
  );

  useEffect(() => {
    if (!transfer.tokenContract) return;
    const api = createApi(network);

    if (!tokenSymbolCache[transfer.tokenContract]) {
      api.callView(transfer.tokenContract, "symbol").then((res) => {
        if (res.success) {
          const sym = new TextDecoder().decode(hexToBytes(res.return_data));
          tokenSymbolCache[transfer.tokenContract!] = sym;
          setSymbol(sym);
        }
      }).catch(() => {});
    } else {
      setSymbol(tokenSymbolCache[transfer.tokenContract]);
    }

    if (tokenDecimalsCache[transfer.tokenContract] === undefined) {
      api.callView(transfer.tokenContract, "decimals").then((res) => {
        if (res.success && res.return_data.length >= 2) {
          const dec = parseInt(res.return_data.slice(0, 2), 16);
          tokenDecimalsCache[transfer.tokenContract!] = dec;
          setDecimals(dec);
        }
      }).catch(() => {});
    } else {
      setDecimals(tokenDecimalsCache[transfer.tokenContract]);
    }
  }, [transfer.tokenContract, network]);

  if (transfer.tokenContract) {
    return <>{formatTokenBalance(transfer.amount, decimals)} {symbol || "tokens"}</>;
  }
  return <>{formatBalance(transfer.amount)} SOLEN</>;
}

function parseLeU128(hex: string): string {
  const bytes = hexToBytes(hex);
  let value = BigInt(0);
  for (let i = Math.min(bytes.length, 16) - 1; i >= 0; i--) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  return value.toString();
}

function parseMintAmount(hex: string): string {
  return parseLeU128(hex);
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
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
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

          // Slash detection.
          const slashEvent = tx.events.find((e) => e.topic === "slashed");
          const slash = slashEvent ? parseSlashEvent(slashEvent.data) : null;
          const isSlash = slash !== null;

          // Intent fulfillment detection.
          const isIntent = tx.events.some((e) => e.topic === "intent_fulfilled");
          const solverTipEvent = tx.events.find((e) => e.topic === "solver_tip");
          const solverTip = solverTipEvent && solverTipEvent.data.length >= 96
            ? { solver: hexToBase58(solverTipEvent.data.slice(0, 64)), amount: parseLeU128(solverTipEvent.data.slice(64, 96)) }
            : null;

          // Bridge events
          const bridgeDepositEvent = tx.events.find((e) => e.topic === "bridge_deposit" && e.data.length >= 136);
          const bridgeReleaseEvent = tx.events.find((e) => e.topic === "bridge_release" && e.data.length >= 96);
          const isBridgeDeposit = bridgeDepositEvent !== undefined;
          const isBridgeRelease = bridgeReleaseEvent !== undefined;
          const bridgeAmount = isBridgeDeposit
            ? parseLeU128(bridgeDepositEvent!.data.slice(104, 136))
            : isBridgeRelease
              ? parseLeU128(bridgeReleaseEvent!.data.slice(64, 96))
              : null;

          // Parse mint events (new format: to[32]+amount[16]=96 hex, old: amount[16]=32 hex)
          const mintEvent = !transfer ? tx.events.find((e) => e.topic === "mint" && e.data.length >= 32 && !e.emitter.startsWith("ffffffff")) : null;
          const mintAmount = mintEvent
            ? mintEvent.data.length >= 96
              ? parseMintAmount(mintEvent.data.slice(64, 96))
              : parseMintAmount(mintEvent.data.slice(0, 32))
            : null;
          return (
            <div
              key={`${tx.block_height}-${tx.index}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-slate-800 px-1 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-mono ${
                  isSlash
                    ? "bg-red-50 dark:bg-red-900/30 text-red-600"
                    : (isBridgeDeposit || isBridgeRelease)
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                      : isIntent
                        ? "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600"
                        : isReward
                          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600"
                          : (transfer?.tokenContract || mintAmount)
                            ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600"
                            : tx.success ? "bg-green-50 dark:bg-green-900/30 text-green-600" : "bg-red-50 dark:bg-red-900/30 text-red-600"
                }`}>
                  {isSlash ? "⚠" : (isBridgeDeposit || isBridgeRelease) ? "🌉" : isIntent ? "⚡" : isReward ? "⛏" : (transfer?.tokenContract || mintAmount) ? "TK" : "Tx"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={tx.tx_hash ? `/tx/hash/${tx.tx_hash}` : `/tx/${tx.block_height}/${tx.index}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      #{formatNumber(tx.block_height)}-{tx.index}
                    </Link>
                    {isSlash && (
                      <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Slash
                      </span>
                    )}
                    {isBridgeDeposit && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                        Bridge → Base
                      </span>
                    )}
                    {isBridgeRelease && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                        Bridge → Solen
                      </span>
                    )}
                    {isIntent && (
                      <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 px-1.5 py-0.5 text-xs font-medium text-cyan-700">
                        Intent
                      </span>
                    )}
                    {isReward && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Reward
                      </span>
                    )}
                  </div>
                  {tx.tx_hash && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-mono">
                      <Link
                        href={`/tx/hash/${tx.tx_hash}`}
                        className="hover:text-indigo-600"
                        title={tx.tx_hash}
                      >
                        {truncateHash(tx.tx_hash, 6)}
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    {isSlash && slash ? (
                      <>
                        <span className="text-red-600">Slashed</span>
                        <Link
                          href={`/account/${slash.validator}`}
                          className="hover:text-indigo-600 font-mono"
                        >
                          {truncateHash(slash.validator, 4)}
                        </Link>
                      </>
                    ) : isReward ? (
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
                {bridgeAmount && (
                  <p className="text-sm font-medium text-indigo-700">
                    {formatBalance(bridgeAmount)} SOLEN
                  </p>
                )}
                {slash && (
                  <p className="text-sm font-medium text-red-700">
                    -{formatBalance(slash.amount)} SOLEN
                  </p>
                )}
                {transfer && !isBridgeDeposit && !isBridgeRelease && (
                  <p className={`text-sm font-medium ${transfer.tokenContract ? "text-purple-700" : "text-gray-900 dark:text-gray-100"}`}>
                    <TokenAmount transfer={transfer} />
                  </p>
                )}
                {reward && (
                  <div>
                    <p className="text-sm font-medium text-amber-700">
                      +{formatBalance(reward.amount)} SOLEN
                    </p>
                    {rewardCount > 1 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{rewardCount} payouts</p>
                    )}
                  </div>
                )}
                {solverTip && (
                  <p className="text-xs text-cyan-600">
                    Tip: {formatBalance(solverTip.amount)} SOLEN
                  </p>
                )}
                {stake && (
                  <p className={`text-sm font-medium ${isDelegate ? "text-blue-700" : "text-orange-700"}`}>
                    {isDelegate ? "Stake " : "Unstake "}{formatBalance(stake.amount)} SOLEN
                  </p>
                )}
                {mintAmount && mintEvent && (
                  <p className="text-sm font-medium text-purple-700">
                    <TokenAmount transfer={{ amount: mintAmount, tokenContract: mintEvent.emitter }} />
                  </p>
                )}
                {!isReward && !isStake && !mintAmount && !transfer && (tx.success ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20 dark:ring-green-400/20">
                    Success
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20">
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
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
            <th className="pb-3 pr-4 font-medium">Txn</th>
            <th className="pb-3 pr-4 font-medium">Tx Hash</th>
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

            const slashEvt = tx.events.find((e) => e.topic === "slashed");
            const slashInfo = slashEvt ? parseSlashEvent(slashEvt.data) : null;

            const isIntent = tx.events.some((e) => e.topic === "intent_fulfilled");
            const solverTipEvt = tx.events.find((e) => e.topic === "solver_tip");
            const solverTip = solverTipEvt && solverTipEvt.data.length >= 96
              ? { solver: hexToBase58(solverTipEvt.data.slice(0, 64)), amount: parseLeU128(solverTipEvt.data.slice(64, 96)) }
              : null;

            // Bridge events
            const bridgeDepEvt = tx.events.find((e) => e.topic === "bridge_deposit" && e.data.length >= 136);
            const bridgeRelEvt = tx.events.find((e) => e.topic === "bridge_release" && e.data.length >= 96);
            const isBridgeDep = bridgeDepEvt !== undefined;
            const isBridgeRel = bridgeRelEvt !== undefined;
            const bridgeAmt = isBridgeDep
              ? parseLeU128(bridgeDepEvt!.data.slice(104, 136))
              : isBridgeRel
                ? parseLeU128(bridgeRelEvt!.data.slice(64, 96))
                : null;

            const mintEvt = !transfer ? tx.events.find((e) => e.topic === "mint" && e.data.length >= 32 && !e.emitter.startsWith("ffffffff")) : null;
            const mintAmt = mintEvt
              ? mintEvt.data.length >= 96
                ? parseMintAmount(mintEvt.data.slice(64, 96))
                : parseMintAmount(mintEvt.data.slice(0, 32))
              : null;
            return (
              <tr
                key={`${tx.block_height}-${tx.index}`}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={tx.tx_hash ? `/tx/hash/${tx.tx_hash}` : `/tx/${tx.block_height}/${tx.index}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {tx.block_height}-{tx.index}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  {tx.tx_hash ? (
                    <Link
                      href={`/tx/hash/${tx.tx_hash}`}
                      className="text-indigo-600 hover:text-indigo-800 font-mono text-xs"
                      title={tx.tx_hash}
                    >
                      {truncateHash(tx.tx_hash, 6)}
                    </Link>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                  )}
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
                    <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700">
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
                  {slashInfo ? (
                    <Link
                      href={`/account/${slashInfo.validator}`}
                      className="text-red-600 hover:text-red-800 font-mono text-xs"
                    >
                      {truncateHash(slashInfo.validator)}
                    </Link>
                  ) : reward ? (
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
                    <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                  )}
                </td>
                <td className="py-3 pr-4 font-medium">
                  {bridgeAmt ? (
                    <span className="text-indigo-700">{formatBalance(bridgeAmt)} SOLEN</span>
                  ) : slashInfo ? (
                    <span className="text-red-700">-{formatBalance(slashInfo.amount)} SOLEN</span>
                  ) : reward ? (
                    <span className="text-amber-700" title={`${rewardCount} payouts`}>+{formatBalance(reward.amount)} SOLEN</span>
                  ) : transfer && !isBridgeDep && !isBridgeRel ? (
                    <div>
                      <span className={transfer.tokenContract ? "text-purple-700" : "text-gray-900 dark:text-gray-100"}>
                        <TokenAmount transfer={transfer} />
                      </span>
                      {solverTip && (
                        <div className="text-xs text-cyan-600">Tip: {formatBalance(solverTip.amount)} SOLEN</div>
                      )}
                    </div>
                  ) : stake ? (
                    <span className={isDelegate ? "text-blue-700" : "text-orange-700"}>
                      {isDelegate ? "Stake " : "Unstake "}{formatBalance(stake.amount)} SOLEN
                    </span>
                  ) : mintAmt && mintEvt ? (
                    <span className="text-purple-700">
                      <TokenAmount transfer={{ amount: mintAmt, tokenContract: mintEvt.emitter }} />
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {slashInfo ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20">
                      Slash
                    </span>
                  ) : isIntent ? (
                    <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-600/20 dark:ring-cyan-400/20">
                      Intent
                    </span>
                  ) : tx.success ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20 dark:ring-green-400/20">
                      Success
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20"
                      title={tx.error || undefined}
                    >
                      Failed
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                  {formatGas(tx.gas_used)}
                </td>
                <td className="py-3 text-gray-600 dark:text-gray-400">
                  {tx.events.length > 0 && (
                    <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700">
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
