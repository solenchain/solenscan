"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatBalance, formatTokenBalance, getTransferInfo, parseTransferEvent, parseRewardEvent, parseStakeEvent } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import { Loading, ErrorMessage } from "@/components/Loading";

const tokenSymbolCache: Record<string, string> = {};
const tokenDecimalsCache: Record<string, number> = {};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function useTokenMeta(contractId: string) {
  const { network } = useNetwork();
  const [symbol, setSymbol] = useState(tokenSymbolCache[contractId] || "");
  const [decimals, setDecimals] = useState(tokenDecimalsCache[contractId] ?? 8);

  useEffect(() => {
    const api = createApi(network);
    if (!tokenSymbolCache[contractId]) {
      api.callView(contractId, "symbol").then((res) => {
        if (res.success) {
          const sym = new TextDecoder().decode(hexToBytes(res.return_data));
          tokenSymbolCache[contractId] = sym;
          setSymbol(sym);
        }
      }).catch(() => {});
    } else {
      setSymbol(tokenSymbolCache[contractId]);
    }
    if (tokenDecimalsCache[contractId] === undefined) {
      api.callView(contractId, "decimals").then((res) => {
        if (res.success && res.return_data.length >= 2) {
          const dec = parseInt(res.return_data.slice(0, 2), 16);
          tokenDecimalsCache[contractId] = dec;
          setDecimals(dec);
        }
      }).catch(() => {});
    } else {
      setDecimals(tokenDecimalsCache[contractId]);
    }
  }, [contractId, network]);

  return { symbol: symbol || "tokens", decimals };
}

function TokenSymbol({ contractId }: { contractId: string }) {
  const { symbol } = useTokenMeta(contractId);
  return <>{symbol}</>;
}

function TokenAmount({ amount, contractId }: { amount: string; contractId: string }) {
  const { symbol, decimals } = useTokenMeta(contractId);
  return <>{formatTokenBalance(amount, decimals)} {symbol}</>;
}

function parseLeU128(hex: string): string {
  const bytes = [];
  for (let i = 0; i < hex.length && i < 32; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  let value = BigInt(0);
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  return value.toString();
}

function parseTxParams(segments: string[]): { height: number; index: number } | null {
  // /tx/384/0
  if (segments.length === 2) {
    const height = Number(segments[0]);
    const index = Number(segments[1]);
    if (!isNaN(height) && !isNaN(index)) return { height, index };
  }
  // /tx/384-0
  if (segments.length === 1) {
    const match = segments[0].match(/^(\d+)-(\d+)$/);
    if (match) return { height: Number(match[1]), index: Number(match[2]) };
  }
  return null;
}

export default function TxDetailPage() {
  const params = useParams();
  const segments = params.params as string[];
  const txId = parseTxParams(segments);

  const { network } = useNetwork();
  const [tx, setTx] = useState<IndexedTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txId) {
      setError(`Invalid transaction ID "${segments.join("/")}". Use format: block-index (e.g. 384-0)`);
      setLoading(false);
      return;
    }

    const mounted = { current: true };

    async function fetchTx() {
      try {
        const api = createApi(network);
        const result = await api.getTx(txId!.height, txId!.index);
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
  }, [network, txId?.height, txId?.index]);

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
        <Row label="Transaction ID" value={`${tx.block_height}-${tx.index}`} />
        <Row label="Status">
          {tx.events.some((e) => e.topic === "intent_fulfilled") ? (
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-1 text-sm font-medium text-cyan-700 ring-1 ring-cyan-600/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-cyan-500" />
              Intent Fulfilled
            </span>
          ) : tx.success ? (
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
          const transfer = getTransferInfo(tx.events, tx.sender);
          const tipEvent = tx.events.find((e) => e.topic === "solver_tip" && e.data.length >= 96);
          const tipTo = tipEvent ? tipEvent.data.slice(0, 64) : null;
          const tipAmount = tipEvent ? parseLeU128(tipEvent.data.slice(64, 96)) : null;
          const feeEvent = tx.events.find((e) => e.topic === "fee");
          const feeAmount = feeEvent ? parseLeU128(feeEvent.data.slice(0, 32)) : null;

          if (transfer) {
            // Compute total cost to sender.
            const transferBig = BigInt(transfer.amount);
            const tipBig = tipAmount ? BigInt(tipAmount) : BigInt(0);
            const feeBig = feeAmount ? BigInt(feeAmount) : BigInt(0);
            const totalCost = transferBig + tipBig + feeBig;

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
                <Row label={transfer.tokenContract ? "Token Transfer" : "Value"}>
                  {transfer.tokenContract ? (
                    <>
                      <span className="text-lg font-semibold text-purple-700">
                        <TokenAmount amount={transfer.amount} contractId={transfer.tokenContract} />
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        via contract{" "}
                        <Link href={`/account/${transfer.tokenContract}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                          {truncateHash(transfer.tokenContract, 8)}
                        </Link>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatBalance(transfer.amount)} SOLEN
                      </span>
                      <span className="ml-2 text-xs text-gray-400">(raw: {transfer.amount})</span>
                    </>
                  )}
                </Row>
                {tipTo && tipAmount && (
                  <Row label="Solver Tip">
                    <span className="text-sm font-semibold text-cyan-700">
                      {formatBalance(tipAmount)} SOLEN
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      to{" "}
                      <Link href={`/account/${tipTo}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                        {truncateHash(tipTo, 8)}
                      </Link>
                    </span>
                  </Row>
                )}
                {(tipBig > BigInt(0) || feeBig > BigInt(0)) && !transfer.tokenContract && (
                  <Row label="Total Cost">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatBalance(totalCost.toString())} SOLEN
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      ({formatBalance(transfer.amount)} transfer
                      {tipBig > BigInt(0) ? ` + ${formatBalance(tipAmount!)} tip` : ""}
                      {feeBig > BigInt(0) ? ` + ${formatBalance(feeAmount!)} fee` : ""})
                    </span>
                  </Row>
                )}
              </>
            );
          }
          // Mint event: new format to[32]+amount[16] (96 hex) or old format amount[16] (32 hex)
          const mintEvent = tx.events.find((e) => e.topic === "mint" && e.data.length >= 32);
          if (mintEvent) {
            let to: string | null = null;
            let amount: string;
            if (mintEvent.data.length >= 96) {
              to = mintEvent.data.slice(0, 64);
              amount = parseLeU128(mintEvent.data.slice(64, 96));
            } else {
              amount = parseLeU128(mintEvent.data.slice(0, 32));
            }
            return (
              <>
                {to && (
                  <Row label="Mint To">
                    <Link href={`/account/${to}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-sm">
                      {to}
                    </Link>
                  </Row>
                )}
                <Row label="Mint Amount">
                  <span className="text-lg font-semibold text-purple-700">
                    <TokenAmount amount={amount} contractId={mintEvent.emitter} />
                  </span>
                </Row>
              </>
            );
          }
          // Validator registered: validator[32] + amount[16]
          const regEvent = tx.events.find((e) => e.topic === "validator_registered" && e.data.length >= 96);
          if (regEvent) {
            const validator = regEvent.data.slice(0, 64);
            const amount = parseLeU128(regEvent.data.slice(64, 96));
            return (
              <>
                <Row label="Validator">
                  <Link href={`/account/${validator}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-sm">
                    {validator}
                  </Link>
                </Row>
                <Row label="Self Stake">
                  <span className="text-lg font-semibold text-blue-700">
                    {formatBalance(amount)} SOLEN
                  </span>
                </Row>
              </>
            );
          }
          // Delegate: validator[32] + amount[16]
          const delegateEvent = tx.events.find((e) => e.topic === "delegate" && e.data.length >= 96);
          if (delegateEvent) {
            const validator = delegateEvent.data.slice(0, 64);
            const amount = parseLeU128(delegateEvent.data.slice(64, 96));
            return (
              <Row label="Staked">
                <span className="text-lg font-semibold text-blue-700">
                  {formatBalance(amount)} SOLEN
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  to{" "}
                  <Link href={`/account/${validator}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                    {truncateHash(validator, 8)}
                  </Link>
                </span>
              </Row>
            );
          }
          return null;
        })()}
        <Row label="Nonce" value={formatNumber(tx.nonce)} />
        <Row label="Gas Used">
          <span className="font-semibold text-gray-900">{formatBalance(tx.gas_used.toString())} SOLEN</span>
          <span className="ml-2 text-xs text-gray-400">(raw: {formatNumber(tx.gas_used)})</span>
        </Row>
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
            {tx.events.map((event, i) => {
              const transferRaw = event.topic === "transfer" ? parseTransferEvent(event.data) : null;
              const isTokenTransfer = transferRaw && event.emitter !== tx.sender;
              const transfer = transferRaw ? { ...transferRaw, tokenContract: isTokenTransfer ? event.emitter : undefined } : null;
              const reward = (event.topic === "epoch_reward" || event.topic === "delegator_reward") ? parseRewardEvent(event.data) : null;
              const isDelegatorReward = event.topic === "delegator_reward";
              const stake = (event.topic === "delegate" || event.topic === "undelegate") ? parseStakeEvent(event.data) : null;
              const isDelegate = event.topic === "delegate";
              const isSolverTip = event.topic === "solver_tip" && event.data.length >= 96;
              const solverTipTo = isSolverTip ? event.data.slice(0, 64) : null;
              const solverTipAmt = isSolverTip ? parseLeU128(event.data.slice(64, 96)) : null;
              const isIntentFulfilled = event.topic === "intent_fulfilled";
              return (
              <div key={i} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        event.topic === "epoch_reward" || event.topic === "delegator_reward"
                          ? "bg-amber-50 text-amber-700"
                          : event.topic === "solver_tip" || event.topic === "intent_fulfilled"
                            ? "bg-cyan-50 text-cyan-700"
                            : "bg-purple-50 text-purple-700"
                      }`}>
                        {event.topic}
                      </span>
                      <span className="text-xs text-gray-400">Event #{i}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-500">Emitter:</span>
                      <Link
                        href={`/account/${event.emitter}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                      >
                        {truncateHash(event.emitter, 10)}
                      </Link>
                      <CopyButton text={event.emitter} />
                    </div>
                    {transfer && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-3 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">To:</span>
                          <Link
                            href={`/account/${transfer.to}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(transfer.to, 12)}
                          </Link>
                          <CopyButton text={transfer.to} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Amount:</span>
                          {transfer.tokenContract ? (
                            <>
                              <span className="text-sm font-medium text-purple-700">{formatNumber(Number(transfer.amount))} <TokenSymbol contractId={transfer.tokenContract} /></span>
                              <span className="text-xs text-gray-400 ml-1">(contract: {truncateHash(transfer.tokenContract, 6)})</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-900">{formatBalance(transfer.amount)} SOLEN</span>
                              <span className="text-xs text-gray-400 ml-1">(raw: {transfer.amount})</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {reward && (
                      <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${isDelegatorReward ? "bg-emerald-50" : "bg-amber-50"}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">{isDelegatorReward ? "Delegator:" : "Validator:"}</span>
                          <Link
                            href={`/account/${reward.validator}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(reward.validator, 12)}
                          </Link>
                          <CopyButton text={reward.validator} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Reward:</span>
                          <span className={`text-sm font-medium ${isDelegatorReward ? "text-emerald-700" : "text-amber-700"}`}>{formatBalance(reward.amount)} SOLEN</span>
                          <span className="text-xs text-gray-400 ml-1">(raw: {reward.amount})</span>
                        </div>
                      </div>
                    )}
                    {stake && (
                      <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${isDelegate ? "bg-blue-50" : "bg-orange-50"}`}>
                        {stake.validator && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 w-16">Validator:</span>
                            <Link
                              href={`/account/${stake.validator}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                            >
                              {truncateHash(stake.validator, 12)}
                            </Link>
                            <CopyButton text={stake.validator} />
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Amount:</span>
                          <span className={`text-sm font-medium ${isDelegate ? "text-blue-700" : "text-orange-700"}`}>
                            {isDelegate ? "+" : "-"}{formatBalance(stake.amount)} SOLEN
                          </span>
                          <span className="text-xs text-gray-400 ml-1">(raw: {stake.amount})</span>
                        </div>
                      </div>
                    )}
                    {isSolverTip && solverTipTo && solverTipAmt && (
                      <div className="mt-2 rounded-lg bg-cyan-50 p-3 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Solver:</span>
                          <Link
                            href={`/account/${solverTipTo}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(solverTipTo, 12)}
                          </Link>
                          <CopyButton text={solverTipTo} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Tip:</span>
                          <span className="text-sm font-medium text-cyan-700">{formatBalance(solverTipAmt)} SOLEN</span>
                          <span className="text-xs text-gray-400 ml-1">(raw: {solverTipAmt})</span>
                        </div>
                      </div>
                    )}
                    {isIntentFulfilled && (
                      <div className="mt-2 rounded-lg bg-cyan-50 p-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-16">Intent ID:</span>
                          <span className="text-sm font-medium text-cyan-700">
                            #{event.data.length >= 16 ? parseInt(parseLeU128(event.data.slice(0, 16))) : event.data}
                          </span>
                        </div>
                      </div>
                    )}
                    {!transfer && !reward && !stake && !isSolverTip && !isIntentFulfilled && event.data && event.data !== "" && event.data !== "00" && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-3">
                        <span className="text-xs text-gray-500">Data:</span>
                        <p className="text-xs font-mono text-gray-700 mt-0.5 break-all">{event.data}</p>
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/block/${event.block_height}`}
                    className="text-xs text-gray-400 shrink-0"
                  >
                    Block #{formatNumber(event.block_height)}
                  </Link>
                </div>
              </div>
              );
            })}
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
