export interface ChainStatus {
  latest_height: number;
  total_blocks: number;
  total_txs: number;
  total_events: number;
}

export interface RpcChainStatus {
  height: number;
  latest_state_root: string;
  pending_ops: number;
}

export interface IndexedBlock {
  height: number;
  epoch: number;
  parent_hash: string;
  state_root: string;
  proposer: string;
  timestamp_ms: number;
  tx_count: number;
  gas_used: number;
}

export interface BlockInfo {
  height: number;
  epoch: number;
  parent_hash: string;
  state_root: string;
  transactions_root: string;
  receipts_root: string;
  proposer: string;
  timestamp_ms: number;
  tx_count: number;
  gas_used: number;
}

export interface IndexedTx {
  block_height: number;
  index: number;
  sender: string;
  nonce: number;
  success: boolean;
  gas_used: number;
  error: string | null;
  events: IndexedEvent[];
}

export interface IndexedEvent {
  block_height: number;
  tx_index: number;
  emitter: string;
  topic: string;
  data: string;
}

export interface AccountInfo {
  id: string;
  balance: string;
  nonce: number;
  code_hash: string;
}

export interface ValidatorInfo {
  id: string;
  stake: string;
  status: "Active" | "Jailed" | "Exiting";
  missed_blocks: number;
}

export interface ValidatorSetResponse {
  validators: ValidatorInfo[];
  total_active_stake: string;
  active_count: number;
  total_count: number;
}

export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}
