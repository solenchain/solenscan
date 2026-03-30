"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";
import { AccountInfo, IndexedTx } from "@/lib/types";
import { formatBalance, formatNumber, isContractAccount, truncateHash } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import { TransactionsTable } from "@/components/TransactionsTable";
import { Loading, ErrorMessage } from "@/components/Loading";

export default function AccountPage() {
  const params = useParams();
  const accountId = params.id as string;
  const { network } = useNetwork();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [txs, setTxs] = useState<IndexedTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"txs" | "contract" | "info">("txs");

  useEffect(() => {
    let mounted = true;

    async function fetchAccount() {
      try {
        const api = createApi(network);
        const [accountInfo, accountTxs] = await Promise.allSettled([
          api.getAccount(accountId),
          api.getAccountTxs(accountId, 50),
        ]);

        if (mounted) {
          if (accountInfo.status === "fulfilled") setAccount(accountInfo.value);
          if (accountTxs.status === "fulfilled") setTxs(accountTxs.value);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to fetch account");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    setLoading(true);
    fetchAccount();
    const id = setInterval(fetchAccount, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [network, accountId]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8"><Loading /></div>;

  const isContract = account ? isContractAccount(account.code_hash) : false;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Account header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
          {account && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isContract
                ? "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20"
                : "bg-gray-100 text-gray-700 ring-1 ring-gray-500/20"
            }`}>
              {isContract ? "Smart Account" : "Standard Account"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <p className="font-mono text-sm text-gray-500 break-all">
            {accountId}
          </p>
          <CopyButton text={accountId} />
        </div>
      </div>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      {/* Overview cards */}
      {account && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Balance</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              {formatBalance(account.balance)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">SOLEN</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Nonce</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              {formatNumber(account.nonce)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">total operations</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Code Hash</p>
            {isContract ? (
              <>
                <p className="mt-1.5 font-mono text-sm text-gray-900 break-all">
                  {truncateHash(account.code_hash, 12)}
                </p>
                <CopyButton text={account.code_hash} />
              </>
            ) : (
              <p className="mt-1.5 text-sm text-gray-400">No contract deployed</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50">
          <div className="flex gap-0">
            {[
              { id: "txs" as const, label: `Transactions (${txs.length})` },
              ...(isContract ? [{ id: "contract" as const, label: "Contract" }] : []),
              { id: "info" as const, label: "Details" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-indigo-600 text-indigo-600 bg-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "txs" ? (
            txs.length > 0 ? (
              <TransactionsTable transactions={txs} accountFilter={accountId} />
            ) : (
              <p className="py-8 text-center text-gray-400">
                No transactions found for this account
              </p>
            )
          ) : activeTab === "contract" ? (
            <ContractTab contractId={accountId} />
          ) : (
            account && (
              <div className="space-y-0">
                <DetailRow label="Account ID" mono>{accountId}</DetailRow>
                <DetailRow label="Account Type">
                  {isContract ? "Smart Account (has deployed code)" : "Standard Account (no code)"}
                </DetailRow>
                <DetailRow label="Balance (raw)" mono>{account.balance}</DetailRow>
                <DetailRow label="Balance (formatted)">{formatBalance(account.balance)} SOLEN</DetailRow>
                <DetailRow label="Nonce">{formatNumber(account.nonce)}</DetailRow>
                <DetailRow label="Code Hash" mono>{account.code_hash}</DetailRow>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ContractTab({ contractId }: { contractId: string }) {
  const { network } = useNetwork();
  const [method, setMethod] = useState("total_supply");
  const [args, setArgs] = useState("");
  const [result, setResult] = useState<{ success: boolean; return_data: string; gas_used: number; error?: string } | null>(null);
  const [querying, setQuerying] = useState(false);

  // Auto-query common SRC-20 methods on load.
  const [tokenInfo, setTokenInfo] = useState<{ totalSupply: string; } | null>(null);

  useEffect(() => {
    const api = createApi(network);
    api.callView(contractId, "total_supply").then((res) => {
      if (res.success && res.return_data.length >= 32) {
        const bytes = hexToBytes(res.return_data);
        const supply = bytesToU128(bytes);
        setTokenInfo({ totalSupply: supply.toString() });
      }
    }).catch(() => {});
  }, [network, contractId]);

  const handleQuery = async () => {
    setQuerying(true);
    setResult(null);
    try {
      const api = createApi(network);
      const res = await api.callView(contractId, method, args || undefined);
      setResult(res);
    } catch (e) {
      setResult({ success: false, return_data: "", gas_used: 0, error: e instanceof Error ? e.message : "Query failed" });
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Token info summary */}
      {tokenInfo && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">SRC-20 Token</h3>
          <div className="text-sm text-purple-700">
            <span className="text-gray-500">Total Supply:</span>{" "}
            <span className="font-mono font-medium">{formatNumber(Number(tokenInfo.totalSupply))}</span>
          </div>
        </div>
      )}

      {/* Read contract */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Read Contract</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="total_supply">total_supply()</option>
            <option value="balance_of">balance_of(account)</option>
            <option value="allowance">allowance(owner, spender)</option>
          </select>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="Args (hex) — e.g., account ID for balance_of"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleQuery}
            disabled={querying}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            {querying ? "Querying..." : "Query"}
          </button>
        </div>

        {result && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${
            result.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}>
            {result.success ? (
              <div className="space-y-1">
                <div>
                  <span className="text-gray-500">Return data:</span>{" "}
                  <span className="font-mono text-gray-900">{result.return_data}</span>
                </div>
                {result.return_data.length === 32 && (
                  <div>
                    <span className="text-gray-500">As u128:</span>{" "}
                    <span className="font-mono text-gray-900 font-medium">
                      {bytesToU128(hexToBytes(result.return_data)).toString()}
                    </span>
                  </div>
                )}
                <div className="text-gray-400">Gas used: {result.gas_used}</div>
              </div>
            ) : (
              <div className="text-red-700">{result.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToU128(bytes: Uint8Array): bigint {
  let value = BigInt(0);
  for (let i = Math.min(bytes.length, 16) - 1; i >= 0; i--) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  return value;
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row border-b border-gray-100 last:border-0">
      <div className="px-4 py-3 text-sm font-medium text-gray-500 sm:w-44">
        {label}
      </div>
      <div className={`px-4 py-3 text-sm text-gray-900 flex-1 break-all ${mono ? "font-mono" : ""}`}>
        {children}
      </div>
    </div>
  );
}
