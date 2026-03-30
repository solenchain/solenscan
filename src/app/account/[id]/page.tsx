"use client";

import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"txs" | "info">("txs");

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
