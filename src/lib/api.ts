import { NetworkConfig } from "./networks";
import {
  ChainStatus,
  RpcChainStatus,
  IndexedBlock,
  BlockInfo,
  IndexedTx,
  IndexedEvent,
  AccountInfo,
  ValidatorSetResponse,
  IndexedRollup,
  IndexedBatch,
  RollupDetail,
  RpcResponse,
} from "./types";

async function fetchExplorer<T>(
  networkId: string,
  path: string
): Promise<T> {
  const res = await fetch(`/api/explorer/${path}`, {
    cache: "no-store",
    headers: { "x-network": networkId },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

async function rpcCall<T>(
  networkId: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-network": networkId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const data: RpcResponse<T> = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result as T;
}

export function createApi(network: NetworkConfig) {
  const id = network.id;

  return {
    getStatus: () =>
      fetchExplorer<ChainStatus>(id, "api/status"),

    getChainStatus: () =>
      rpcCall<RpcChainStatus>(id, "solen_chainStatus"),

    getBlocks: (limit = 20, offset = 0) =>
      fetchExplorer<IndexedBlock[]>(id, `api/blocks?limit=${limit}&offset=${offset}`),

    getBlock: (height: number) =>
      fetchExplorer<IndexedBlock>(id, `api/blocks/${height}`),

    getBlockRpc: (height: number) =>
      rpcCall<BlockInfo>(id, "solen_getBlock", { height }),

    getTx: (blockHeight: number, index: number) =>
      fetchExplorer<IndexedTx>(id, `api/tx/${blockHeight}/${index}`),

    getBlockTxs: (blockHeight: number) =>
      fetchExplorer<IndexedTx[]>(id, `api/blocks/${blockHeight}/txs`),

    getRecentTxs: (limit = 50, offset = 0) =>
      fetchExplorer<IndexedTx[]>(id, `api/txs?limit=${limit}&offset=${offset}`),

    getAccountTxs: (account: string, limit = 20, offset = 0) =>
      fetchExplorer<IndexedTx[]>(id, `api/accounts/${account}/txs?limit=${limit}&offset=${offset}`),

    getEvents: (limit = 20, offset = 0) =>
      fetchExplorer<IndexedEvent[]>(id, `api/events?limit=${limit}&offset=${offset}`),

    getAccount: (accountId: string) =>
      rpcCall<AccountInfo>(id, "solen_getAccount", { account_id: accountId }),

    getBalance: (accountId: string) =>
      rpcCall<string>(id, "solen_getBalance", { account_id: accountId }),

    getLatestBlock: () =>
      rpcCall<BlockInfo>(id, "solen_getLatestBlock"),

    getValidators: () =>
      fetchExplorer<ValidatorSetResponse>(id, "api/validators"),

    getGovernanceProposals: () =>
      rpcCall<{ id: number; proposer: string; action: string; description: string; status: string; voting_end_epoch: number; execute_after_epoch: number; total_for: string; total_against: string; vote_count: number }[]>(
        id, "solen_getGovernanceProposals"
      ),

    getValidatorStats: () =>
      fetchExplorer<{ validator: string; blocks_proposed: number; last_proposed_height: number; uptime_pct: number }[]>(
        id, "api/validators/stats"
      ),

    callView: (contractId: string, method: string, argsHex?: string) =>
      rpcCall<{ success: boolean; return_data: string; gas_used: number; error?: string }>(
        id, "solen_callView", { contract_id: contractId, method, args: argsHex || null }
      ),

    getAccountTokens: (account: string) =>
      fetchExplorer<string[]>(id, `api/accounts/${account}/tokens`),

    getContracts: () =>
      fetchExplorer<string[]>(id, "api/contracts"),

    getTokenHolders: (contractId: string) =>
      fetchExplorer<string[]>(id, `api/contracts/${contractId}/holders`),

    getContractSource: (codeHash: string) =>
      fetchExplorer<{ code_hash: string; source_code: string; language: string; compiler_version: string; published_at: number; verified: boolean } | null>(
        id, `api/contracts/${codeHash}/source`
      ),

    getRollups: () =>
      fetchExplorer<IndexedRollup[]>(id, "api/rollups"),

    getRollup: (rollupId: number) =>
      fetchExplorer<RollupDetail | null>(id, `api/rollups/${rollupId}`),

    getRollupBatches: (rollupId: number, limit = 20) =>
      fetchExplorer<IndexedBatch[]>(id, `api/rollups/${rollupId}/batches?limit=${limit}`),
  };
}
