"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { IndexedTx } from "@/lib/types";
import { truncateHash, formatNumber, formatBalance, formatTokenBalance, getTransferInfo, parseTransferEvent, parseRewardEvent, parseStakeEvent, parseSlashEvent, hexToBase58 } from "@/lib/utils";
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
    if (!contractId) return;
    const api = createApi(network);
    if (!tokenSymbolCache[contractId]) {
      api.callView(contractId, "symbol").then((res) => {
        if (res.success) {
          const sym = new TextDecoder().decode(hexToBytes(res.return_data));
          // Contracts that don't implement `symbol` fall through to their
          // default dispatcher which returns `err:unknown_method` via
          // `sdk::return_value` — still success=true at the callView layer.
          // Treat those as "no symbol".
          const clean = sym.startsWith("err:") ? "" : sym;
          tokenSymbolCache[contractId] = clean;
          setSymbol(clean);
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

// Cache: pair contract address → the SRC-20 contract it's bound to. Populated
// by looking up the pair's `initialized` event (which encodes owner[32] +
// token_contract[32]). Pair-template doesn't expose a `token_contract` view,
// so the event lookup is the only dynamic path.
const pairTokenCache: Record<string, string> = {};

function usePairBoundToken(pairAddr: string): string {
  const { network } = useNetwork();
  const [tokenContract, setTokenContract] = useState(pairTokenCache[pairAddr] || "");

  useEffect(() => {
    if (!pairAddr || pairTokenCache[pairAddr]) {
      if (pairTokenCache[pairAddr]) setTokenContract(pairTokenCache[pairAddr]);
      return;
    }
    const url = `${network.explorerApiUrl}/api/events?contract=${encodeURIComponent(pairAddr)}&topic=initialized&limit=1`;
    fetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then((rows: { data?: string }[]) => {
        const data = rows[0]?.data || "";
        // event data = owner[32] || token_contract[32] in hex (128 chars total).
        if (data.length >= 128) {
          const tc = data.slice(64, 128);
          pairTokenCache[pairAddr] = tc;
          setTokenContract(tc);
        }
      })
      .catch(() => {});
  }, [pairAddr, network]);

  return tokenContract;
}

/** Resolved symbol for a pair's bound token. Falls back to "TOKEN" pre-resolve. */
function usePairTokenSymbol(pairAddr: string): string {
  const tokenContract = usePairBoundToken(pairAddr);
  const { symbol } = useTokenMeta(tokenContract);
  if (!tokenContract) return "TOKEN";
  return symbol === "tokens" ? "TOKEN" : symbol;
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

// AMM event parsers (SolenSwap). Direction/side bytes are returned raw so the
// renderer can substitute the pair's actual token symbol (resolved dynamically
// via the pair's `initialized` event) — no more hardcoded "STT".
interface AmmSwapInfo { solenToToken: boolean; amountIn: string; amountOut: string; }
interface AmmDepositInfo { isSolenSide: boolean; account: string; amount: string; }
interface AmmLiquidityInfo { solen: string; token: string; lp: string; }

function parseAmmSwap(data: string): AmmSwapInfo | null {
  if (data.length < 66) return null;
  return {
    solenToToken: data.slice(0, 2) === "00",
    amountIn: parseLeU128(data.slice(2, 34)),
    amountOut: parseLeU128(data.slice(34, 66)),
  };
}

function parseAmmDeposit(data: string): AmmDepositInfo | null {
  if (data.length < 98) return null;
  return {
    isSolenSide: data.slice(0, 2) === "00",
    account: hexToBase58(data.slice(2, 66)),
    amount: parseLeU128(data.slice(66, 98)),
  };
}

function parseAmmLiquidity(data: string): AmmLiquidityInfo | null {
  if (data.length < 96) return null;
  return { solen: parseLeU128(data.slice(0, 32)), token: parseLeU128(data.slice(32, 64)), lp: parseLeU128(data.slice(64, 96)) };
}

// ── AMM event cards ────────────────────────────────────────────────

function AmmSwapCard({ pairAddr, info }: { pairAddr: string; info: AmmSwapInfo }) {
  const sym = usePairTokenSymbol(pairAddr);
  const inTicker = info.solenToToken ? "SOLEN" : sym;
  const outTicker = info.solenToToken ? sym : "SOLEN";
  return (
    <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
          {inTicker} → {outTicker}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">In:</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatBalance(info.amountIn)} {inTicker}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Out:</span>
        <span className="text-sm font-medium text-green-700 dark:text-green-400">{formatBalance(info.amountOut)} {outTicker}</span>
      </div>
    </div>
  );
}

function AmmDepositCard({ pairAddr, info, kind }: { pairAddr: string; info: AmmDepositInfo; kind: "deposit" | "withdraw" }) {
  const sym = usePairTokenSymbol(pairAddr);
  const ticker = info.isSolenSide ? "SOLEN" : sym;
  const isWithdraw = kind === "withdraw";
  return (
    <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${isWithdraw ? "bg-orange-50 dark:bg-orange-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{isWithdraw ? "Withdraw:" : "Deposit:"}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {formatBalance(info.amount)} {ticker}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Account:</span>
        <Link href={`/account/${info.account}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-mono">
          {truncateHash(info.account, 12)}
        </Link>
      </div>
    </div>
  );
}

function AmmLiquidityCard({ pairAddr, info, kind }: { pairAddr: string; info: AmmLiquidityInfo; kind: "added" | "removed" }) {
  const sym = usePairTokenSymbol(pairAddr);
  const removed = kind === "removed";
  return (
    <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${removed ? "bg-red-50 dark:bg-red-900/20" : "bg-teal-50 dark:bg-teal-900/20"}`}>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">SOLEN:</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatBalance(info.solen)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{sym}:</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatBalance(info.token)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">LP Shares:</span>
        <span className="text-sm font-medium text-teal-700 dark:text-teal-400">{formatBalance(info.lp)}</span>
      </div>
    </div>
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Transaction Details
      </h1>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mb-6">
        <Row label="Transaction ID" value={`${tx.block_height}-${tx.index}`} />
        <Row label="Status">
          {tx.events.some((e) => e.topic === "bridge_deposit") ? (
            <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/20 dark:ring-indigo-400/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-indigo-500" />
              Bridge Deposit
            </span>
          ) : tx.events.some((e) => e.topic === "bridge_release") ? (
            <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/20 dark:ring-indigo-400/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-indigo-500" />
              Bridge Release
            </span>
          ) : tx.events.some((e) => e.topic === "intent_fulfilled") ? (
            <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2.5 py-1 text-sm font-medium text-cyan-700 ring-1 ring-cyan-600/20 dark:ring-cyan-400/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-cyan-500" />
              Intent Fulfilled
            </span>
          ) : tx.success ? (
            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-1 text-sm font-medium text-green-700 ring-1 ring-green-600/20 dark:ring-green-400/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500" />
              Success
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2.5 py-1 text-sm font-medium text-red-700 ring-1 ring-red-600/20 dark:ring-red-400/20">
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
          const tipTo = tipEvent ? hexToBase58(tipEvent.data.slice(0, 64)) : null;
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
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        via contract{" "}
                        <Link href={`/account/${transfer.tokenContract}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                          {truncateHash(transfer.tokenContract, 8)}
                        </Link>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {formatBalance(transfer.amount)} SOLEN
                      </span>
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(raw: {transfer.amount})</span>
                    </>
                  )}
                </Row>
                {tipTo && tipAmount && (
                  <Row label="Solver Tip">
                    <span className="text-sm font-semibold text-cyan-700">
                      {formatBalance(tipAmount)} SOLEN
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      to{" "}
                      <Link href={`/account/${tipTo}`} className="text-indigo-600 hover:text-indigo-800 font-mono">
                        {truncateHash(tipTo, 8)}
                      </Link>
                    </span>
                  </Row>
                )}
                {(tipBig > BigInt(0) || feeBig > BigInt(0)) && !transfer.tokenContract && (
                  <Row label="Total Cost">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatBalance(totalCost.toString())} SOLEN
                    </span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      ({formatBalance(transfer.amount)} transfer
                      {tipBig > BigInt(0) ? ` + ${formatBalance(tipAmount!)} tip` : ""}
                      {feeBig > BigInt(0) ? ` + ${formatBalance(feeAmount!)} fee` : ""})
                    </span>
                  </Row>
                )}
              </>
            );
          }
          // Bridge deposit: sender[32] + base_recipient[20] + amount[16]
          const bridgeDepEvent = tx.events.find((e) => e.topic === "bridge_deposit" && e.data.length >= 136);
          if (bridgeDepEvent) {
            const sender = hexToBase58(bridgeDepEvent.data.slice(0, 64));
            const baseRecipient = "0x" + bridgeDepEvent.data.slice(64, 104);
            const amount = parseLeU128(bridgeDepEvent.data.slice(104, 136));
            return (
              <>
                <Row label="Type">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/20 dark:ring-indigo-400/20">
                    Bridge Deposit (Solen → Base)
                  </span>
                </Row>
                <Row label="Value">
                  <span className="text-lg font-semibold text-indigo-700">
                    {formatBalance(amount)} SOLEN
                  </span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(raw: {amount})</span>
                </Row>
                <Row label="Base Recipient">
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{baseRecipient}</span>
                  <CopyButton text={baseRecipient} />
                </Row>
                {feeAmount && (
                  <Row label="Fee">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{formatBalance(feeAmount)} SOLEN</span>
                  </Row>
                )}
              </>
            );
          }

          // Bridge release: recipient[32] + amount[16] + base_tx_hash[32]
          const bridgeRelEvent = tx.events.find((e) => e.topic === "bridge_release" && e.data.length >= 96);
          if (bridgeRelEvent) {
            const recipient = hexToBase58(bridgeRelEvent.data.slice(0, 64));
            const amount = parseLeU128(bridgeRelEvent.data.slice(64, 96));
            return (
              <>
                <Row label="Type">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/20 dark:ring-indigo-400/20">
                    Bridge Release (Base → Solen)
                  </span>
                </Row>
                <Row label="To">
                  <Link href={`/account/${recipient}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-sm">
                    {recipient}
                  </Link>
                  <CopyButton text={recipient} />
                </Row>
                <Row label="Value">
                  <span className="text-lg font-semibold text-indigo-700">
                    {formatBalance(amount)} SOLEN
                  </span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(raw: {amount})</span>
                </Row>
                {feeAmount && (
                  <Row label="Fee">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{formatBalance(feeAmount)} SOLEN</span>
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
              to = hexToBase58(mintEvent.data.slice(0, 64));
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
            const validator = hexToBase58(regEvent.data.slice(0, 64));
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
            const validator = hexToBase58(delegateEvent.data.slice(0, 64));
            const amount = parseLeU128(delegateEvent.data.slice(64, 96));
            return (
              <Row label="Staked">
                <span className="text-lg font-semibold text-blue-700">
                  {formatBalance(amount)} SOLEN
                </span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
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
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBalance(tx.gas_used.toString())} SOLEN</span>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(raw: {formatNumber(tx.gas_used)})</span>
        </Row>
        {tx.error && (
          <Row label="Error">
            <span className="text-red-600 font-mono text-sm">{tx.error}</span>
          </Row>
        )}
      </div>

      {/* Events */}
      {tx.events.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/50">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              Events ({tx.events.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {tx.events.map((event, i) => {
              const transferRaw = event.topic === "transfer" ? parseTransferEvent(event.data) : null;
              const isTokenTransfer = transferRaw && event.emitter !== tx.sender;
              const transfer = transferRaw ? { ...transferRaw, tokenContract: isTokenTransfer ? event.emitter : undefined } : null;
              const reward = (event.topic === "epoch_reward" || event.topic === "delegator_reward") ? parseRewardEvent(event.data) : null;
              const isDelegatorReward = event.topic === "delegator_reward";
              const stake = (event.topic === "delegate" || event.topic === "undelegate") ? parseStakeEvent(event.data) : null;
              const isDelegate = event.topic === "delegate";
              const slashData = event.topic === "slashed" ? parseSlashEvent(event.data) : null;
              const isSolverTip = event.topic === "solver_tip" && event.data.length >= 96;
              const solverTipTo = isSolverTip ? hexToBase58(event.data.slice(0, 64)) : null;
              const solverTipAmt = isSolverTip ? parseLeU128(event.data.slice(64, 96)) : null;
              const isIntentFulfilled = event.topic === "intent_fulfilled";
              // AMM events
              // Bridge events
              const bridgeDeposit = event.topic === "bridge_deposit" && event.data.length >= 136 ? {
                sender: hexToBase58(event.data.slice(0, 64)),
                baseRecipient: "0x" + event.data.slice(64, 104),
                amount: parseLeU128(event.data.slice(104, 136)),
              } : null;
              const bridgeRelease = event.topic === "bridge_release" && event.data.length >= 96 ? {
                recipient: hexToBase58(event.data.slice(0, 64)),
                amount: parseLeU128(event.data.slice(64, 96)),
              } : null;
              const ammSwap = event.topic === "swap" ? parseAmmSwap(event.data) : null;
              const ammDeposit = event.topic === "deposit" ? parseAmmDeposit(event.data) : null;
              const ammWithdraw = event.topic === "withdraw" ? parseAmmDeposit(event.data) : null;
              const ammLiqAdded = event.topic === "liquidity_added" ? parseAmmLiquidity(event.data) : null;
              const ammLiqRemoved = event.topic === "liquidity_removed" ? parseAmmLiquidity(event.data) : null;
              return (
              <div key={i} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        event.topic === "slashed"
                          ? "bg-red-50 dark:bg-red-900/30 text-red-700"
                          : event.topic === "epoch_reward" || event.topic === "delegator_reward"
                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700"
                            : event.topic === "solver_tip" || event.topic === "intent_fulfilled"
                              ? "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700"
                              : event.topic === "swap"
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700"
                                : event.topic === "bridge_deposit" || event.topic === "bridge_release"
                                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700"
                                  : event.topic === "deposit" || event.topic === "withdraw"
                                  ? "bg-green-50 dark:bg-green-900/30 text-green-700"
                                  : event.topic === "liquidity_added" || event.topic === "liquidity_removed"
                                    ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700"
                                    : "bg-purple-50 dark:bg-purple-900/30 text-purple-700"
                      }`}>
                        {event.topic}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Event #{i}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Emitter:</span>
                      <Link
                        href={`/account/${event.emitter}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                      >
                        {truncateHash(event.emitter, 10)}
                      </Link>
                      <CopyButton text={event.emitter} />
                    </div>
                    {transfer && (
                      <div className="mt-2 rounded-lg bg-gray-50 dark:bg-slate-950 p-3 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">To:</span>
                          <Link
                            href={`/account/${transfer.to}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(transfer.to, 12)}
                          </Link>
                          <CopyButton text={transfer.to} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Amount:</span>
                          {transfer.tokenContract ? (
                            <>
                              <span className="text-sm font-medium text-purple-700"><TokenAmount amount={transfer.amount} contractId={transfer.tokenContract} /></span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(contract: {truncateHash(transfer.tokenContract, 6)})</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatBalance(transfer.amount)} SOLEN</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(raw: {transfer.amount})</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {reward && (
                      <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${isDelegatorReward ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-amber-50 dark:bg-amber-900/30"}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{isDelegatorReward ? "Delegator:" : "Validator:"}</span>
                          <Link
                            href={`/account/${reward.validator}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(reward.validator, 12)}
                          </Link>
                          <CopyButton text={reward.validator} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Reward:</span>
                          <span className={`text-sm font-medium ${isDelegatorReward ? "text-emerald-700" : "text-amber-700"}`}>{formatBalance(reward.amount)} SOLEN</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(raw: {reward.amount})</span>
                        </div>
                      </div>
                    )}
                    {stake && (
                      <div className={`mt-2 rounded-lg p-3 space-y-1.5 ${isDelegate ? "bg-blue-50 dark:bg-blue-900/30" : "bg-orange-50 dark:bg-orange-900/30"}`}>
                        {stake.validator && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Validator:</span>
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
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Amount:</span>
                          <span className={`text-sm font-medium ${isDelegate ? "text-blue-700" : "text-orange-700"}`}>
                            {isDelegate ? "+" : "-"}{formatBalance(stake.amount)} SOLEN
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(raw: {stake.amount})</span>
                        </div>
                      </div>
                    )}
                    {slashData && (
                      <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Validator:</span>
                          <Link
                            href={`/account/${slashData.validator}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(slashData.validator, 12)}
                          </Link>
                          <CopyButton text={slashData.validator} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Penalty:</span>
                          <span className="text-sm font-medium text-red-700">-{formatBalance(slashData.amount)} SOLEN</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(raw: {slashData.amount})</span>
                        </div>
                      </div>
                    )}
                    {isSolverTip && solverTipTo && solverTipAmt && (
                      <div className="mt-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 p-3 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Solver:</span>
                          <Link
                            href={`/account/${solverTipTo}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                          >
                            {truncateHash(solverTipTo, 12)}
                          </Link>
                          <CopyButton text={solverTipTo} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Tip:</span>
                          <span className="text-sm font-medium text-cyan-700">{formatBalance(solverTipAmt)} SOLEN</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(raw: {solverTipAmt})</span>
                        </div>
                      </div>
                    )}
                    {isIntentFulfilled && (
                      <div className="mt-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 p-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Intent ID:</span>
                          <span className="text-sm font-medium text-cyan-700">
                            #{event.data.length >= 16 ? parseInt(parseLeU128(event.data.slice(0, 16))) : event.data}
                          </span>
                        </div>
                      </div>
                    )}
                    {ammSwap && <AmmSwapCard pairAddr={event.emitter} info={ammSwap} />}
                    {ammDeposit && <AmmDepositCard pairAddr={event.emitter} info={ammDeposit} kind="deposit" />}
                    {ammWithdraw && <AmmDepositCard pairAddr={event.emitter} info={ammWithdraw} kind="withdraw" />}
                    {ammLiqAdded && <AmmLiquidityCard pairAddr={event.emitter} info={ammLiqAdded} kind="added" />}
                    {ammLiqRemoved && <AmmLiquidityCard pairAddr={event.emitter} info={ammLiqRemoved} kind="removed" />}
                    {bridgeDeposit && (
                      <div className="mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 space-y-1.5">
                        <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Bridge Deposit (Solen &rarr; Base)</div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-20">From:</span>
                          <Link href={`/account/${bridgeDeposit.sender}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-mono">
                            {truncateHash(bridgeDeposit.sender, 12)}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-20">Base To:</span>
                          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{bridgeDeposit.baseRecipient}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-20">Amount:</span>
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{formatBalance(bridgeDeposit.amount)} SOLEN</span>
                        </div>
                      </div>
                    )}
                    {bridgeRelease && (
                      <div className="mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 space-y-1.5">
                        <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Bridge Release (Base &rarr; Solen)</div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-20">To:</span>
                          <Link href={`/account/${bridgeRelease.recipient}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-mono">
                            {truncateHash(bridgeRelease.recipient, 12)}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-20">Amount:</span>
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{formatBalance(bridgeRelease.amount)} SOLEN</span>
                        </div>
                      </div>
                    )}
                    {!transfer && !reward && !stake && !slashData && !isSolverTip && !isIntentFulfilled && !ammSwap && !ammDeposit && !ammWithdraw && !ammLiqAdded && !ammLiqRemoved && !bridgeDeposit && !bridgeRelease && event.data && event.data !== "" && event.data !== "00" && (
                      <div className="mt-2 rounded-lg bg-gray-50 dark:bg-slate-950 p-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Data:</span>
                        <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-0.5 break-all">{event.data}</p>
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/block/${event.block_height}`}
                    className="text-xs text-gray-400 dark:text-gray-500 shrink-0"
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
    <div className="flex flex-col sm:flex-row border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="px-6 py-3.5 text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-48 bg-gray-50/50 dark:bg-slate-800/50">
        {label}
      </div>
      <div className="px-6 py-3.5 text-sm text-gray-900 dark:text-gray-100 flex-1 flex items-center gap-1">
        {value || children}
      </div>
    </div>
  );
}
