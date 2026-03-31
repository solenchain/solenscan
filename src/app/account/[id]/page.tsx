"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  const [tokenBalances, setTokenBalances] = useState<{ contract: string; name: string; symbol: string; balance: string }[]>([]);

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

          // Fetch token balances for this account.
          api.getAccountTokens(accountId).then(async (contracts) => {
            if (!mounted || contracts.length === 0) return;
            const balances = await Promise.all(
              contracts.map(async (contractId) => {
                try {
                  const [balRes, nameRes, symRes] = await Promise.all([
                    api.callView(contractId, "balance_of", accountId),
                    api.callView(contractId, "name"),
                    api.callView(contractId, "symbol"),
                  ]);
                  if (!balRes.success) return null;
                  const balBytes = hexToBytes(balRes.return_data);
                  const bal = bytesToU128(balBytes);
                  if (bal === BigInt(0)) return null;
                  return {
                    contract: contractId,
                    name: nameRes.success ? new TextDecoder().decode(hexToBytes(nameRes.return_data)) : contractId.slice(0, 12) + "...",
                    symbol: symRes.success ? new TextDecoder().decode(hexToBytes(symRes.return_data)) : "???",
                    balance: bal.toString(),
                  };
                } catch { return null; }
              })
            );
            if (mounted) {
              setTokenBalances(balances.filter((b): b is NonNullable<typeof b> => b !== null));
            }
          }).catch(() => {});
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

      {/* Token balances */}
      {tokenBalances.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Token Balances</h3>
          <div className="space-y-2">
            {tokenBalances.map((token) => (
              <div key={token.contract} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium">
                    {token.symbol}
                  </span>
                  <Link href={`/account/${token.contract}`} className="text-sm text-indigo-600 hover:text-indigo-800">
                    {token.name}
                  </Link>
                </div>
                <span className="font-mono text-sm font-medium text-gray-900">
                  {formatNumber(Number(token.balance))}
                </span>
              </div>
            ))}
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
            <ContractTab contractId={accountId} account={account} />
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

interface AbiMethod {
  name: string;
  args: string;
  mutates: boolean;
}

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

interface AbiEvent {
  topic: string;
  data: string;
}

interface ContractAbi {
  methods: AbiMethod[];
  events: AbiEvent[];
}

function ContractTab({ contractId, account }: { contractId: string; account: AccountInfo | null }) {
  const { network } = useNetwork();
  const [abi, setAbi] = useState<ContractAbi | null>(null);
  const [methods, setMethods] = useState<AbiMethod[]>([]);
  const [method, setMethod] = useState("");
  const [args, setArgs] = useState("");
  const [result, setResult] = useState<{ success: boolean; return_data: string; gas_used: number; error?: string } | null>(null);
  const [querying, setQuerying] = useState(false);
  const [tokenMeta, setTokenMeta] = useState<TokenMeta | null>(null);
  const [owner, setOwner] = useState<string | null>(null);

  // Probe contract for ABI and token metadata on load.
  useEffect(() => {
    const api = createApi(network);

    // Try to load ABI (supports old array format and new object format).
    api.callView(contractId, "abi").then((res) => {
      if (res.success && res.return_data) {
        try {
          const json = new TextDecoder().decode(hexToBytes(res.return_data));
          const parsed = JSON.parse(json);
          let allMethods: AbiMethod[];
          if (Array.isArray(parsed)) {
            allMethods = parsed;
            setAbi({ methods: parsed, events: [] });
          } else {
            allMethods = parsed.methods || [];
            setAbi({ methods: allMethods, events: parsed.events || [] });
          }
          setMethods(allMethods.filter((m: AbiMethod) => !m.mutates && m.name !== "abi"));
          if (!method) setMethod(allMethods.find((m: AbiMethod) => !m.mutates && m.name !== "abi")?.name || "");
        } catch { /* not valid ABI */ }
      }
    }).catch(() => {});

    // Try to load token metadata.
    Promise.all([
      api.callView(contractId, "name").catch(() => null),
      api.callView(contractId, "symbol").catch(() => null),
      api.callView(contractId, "decimals").catch(() => null),
      api.callView(contractId, "total_supply").catch(() => null),
    ]).then(([nameRes, symbolRes, decimalsRes, supplyRes]) => {
      const name = nameRes?.success ? new TextDecoder().decode(hexToBytes(nameRes.return_data)) : "";
      const symbol = symbolRes?.success ? new TextDecoder().decode(hexToBytes(symbolRes.return_data)) : "";
      const decimals = decimalsRes?.success && decimalsRes.return_data.length >= 2
        ? parseInt(decimalsRes.return_data.slice(0, 2), 16)
        : 0;
      const totalSupply = supplyRes?.success && supplyRes.return_data.length >= 32
        ? bytesToU128(hexToBytes(supplyRes.return_data)).toString()
        : "";

      if (totalSupply) {
        setTokenMeta({ name, symbol, decimals, totalSupply });
      }
    });

    // Try to get contract owner.
    api.callView(contractId, "owner").catch(() => null).then((res) => {
      if (res?.success && res.return_data.length === 64) {
        setOwner(res.return_data);
      }
    });
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

  const selectedMethod = methods.find((m) => m.name === method);

  return (
    <div className="space-y-6">
      {/* Token metadata */}
      {tokenMeta && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-purple-900">SRC-20 Token</h3>
            {tokenMeta.symbol && (
              <span className="text-xs bg-purple-200 text-purple-800 rounded-full px-2 py-0.5 font-medium">
                {tokenMeta.symbol}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {tokenMeta.name && (
              <div>
                <span className="text-gray-500 text-xs">Name</span>
                <p className="font-medium text-purple-900">{tokenMeta.name}</p>
              </div>
            )}
            {tokenMeta.symbol && (
              <div>
                <span className="text-gray-500 text-xs">Symbol</span>
                <p className="font-medium text-purple-900">{tokenMeta.symbol}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 text-xs">Decimals</span>
              <p className="font-medium text-purple-900">{tokenMeta.decimals}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Total Supply</span>
              <p className="font-medium text-purple-900">{formatNumber(Number(tokenMeta.totalSupply))}</p>
            </div>
          </div>
          {owner && (
            <div className="mt-3 pt-3 border-t border-purple-200 text-sm">
              <span className="text-gray-500 text-xs">Owner</span>
              <p className="font-mono text-xs mt-0.5">
                <Link href={`/account/${owner}`} className="text-indigo-600 hover:text-indigo-800">
                  {owner}
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Read contract */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Read Contract</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          {methods.length > 0 ? (
            <select
              value={method}
              onChange={(e) => { setMethod(e.target.value); setArgs(""); setResult(null); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {methods.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}({m.args || ""})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Method name"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          {selectedMethod?.args && (
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={selectedMethod.args.replace(/\+/g, " + ")}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <button
            onClick={handleQuery}
            disabled={querying || !method}
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
                  <span className="font-mono text-gray-900 break-all">{result.return_data}</span>
                </div>
                {result.return_data.length === 32 && (
                  <div>
                    <span className="text-gray-500">As u128:</span>{" "}
                    <span className="font-mono text-gray-900 font-medium">
                      {bytesToU128(hexToBytes(result.return_data)).toString()}
                    </span>
                  </div>
                )}
                {result.return_data.length > 0 && result.return_data.length !== 32 && (
                  <div>
                    <span className="text-gray-500">As text:</span>{" "}
                    <span className="text-gray-900">
                      {new TextDecoder().decode(hexToBytes(result.return_data))}
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

      {/* Write contract */}
      {abi && abi.methods.filter((m) => m.mutates && m.name !== "abi" && m.name !== "init").length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Write Contract</h3>
          <p className="text-xs text-gray-500 mb-3">
            To call write methods, use the CLI:
          </p>
          <div className="space-y-2">
            {abi.methods
              .filter((m) => m.mutates && m.name !== "abi" && m.name !== "init")
              .map((m) => (
                <div key={m.name} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">write</span>
                  </div>
                  {m.args && (
                    <p className="text-xs text-gray-500 mb-2">Args: {m.args.replace(/\+/g, " + ")}</p>
                  )}
                  <code className="block text-xs bg-gray-900 text-green-400 p-2 rounded font-mono break-all">
                    solen --chain-id 9000 call &lt;key&gt; {contractId.slice(0, 16)}... {m.name}{m.args ? " --args <hex>" : ""}
                  </code>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Events ABI */}
      {abi && abi.events.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Events</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Topic</th>
                  <th className="pb-2 font-medium">Data Format</th>
                </tr>
              </thead>
              <tbody>
                {abi.events.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{e.topic}</span>
                    </td>
                    <td className="py-2 font-mono text-xs text-gray-600">{e.data.replace(/\+/g, " + ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source code */}
      <SourceCode contractId={contractId} codeHash={account?.code_hash || ""} />
    </div>
  );
}

function SourceCode({ contractId, codeHash }: { contractId: string; codeHash: string }) {
  const { network } = useNetwork();
  const [source, setSource] = useState<{ source_code: string; language: string; compiler_version: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeHash || codeHash === "0".repeat(64)) { setLoading(false); return; }
    const api = createApi(network);
    api.getContractSource(codeHash).then((res) => {
      setSource(res);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [codeHash, network]);

  if (loading) return null;

  if (!source) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Source Code</h3>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500 mb-2">Source code not published</p>
          <p className="text-xs text-gray-400">
            Contract deployers can publish source via the API:
          </p>
          <code className="block text-xs bg-gray-900 text-green-400 p-2 rounded font-mono mt-2 text-left">
            POST /api/contracts/{codeHash.slice(0, 16)}../source
          </code>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Source Code</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Published</span>
          <span className="text-xs text-gray-400">{source.language} · {source.compiler_version}</span>
        </div>
      </div>
      <pre className="rounded-lg bg-gray-900 text-gray-100 p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
        {source.source_code}
      </pre>
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
