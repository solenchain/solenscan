export interface ChainStatus {
  latest_height: number;
  total_blocks: number;
  total_txs: number;
  total_events: number;
}

export interface ChainConfig {
  block_time_ms: number;
  min_validator_stake: string;
  unbonding_period_epochs: number;
  epoch_length: number;
  base_fee_per_gas: string;
  burn_rate_bps: number;
}

export interface RpcChainStatus {
  height: number;
  state_root: string;
  pending_ops: number;
  total_allocation: string;
  total_staked: string;
  total_circulation: string;
  config?: ChainConfig;
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
  /** `blake3(block_height_le ‖ tx_index_le ‖ sender ‖ nonce_le)`, hex-encoded.
   *  Same value RPC clients see as `tx_hash` from `solen_submitOperationConfirm`.
   *  May be empty on records produced by older indexer builds, or on backfill
   *  paths where the block placement isn't known. */
  tx_hash?: string;
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
  self_stake: string;
  delegated: string;
  status: "Active" | "Jailed" | "Exiting";
  missed_blocks: number;
  commission_pct: string;
  is_genesis: boolean;
}

export interface ValidatorSetResponse {
  validators: ValidatorInfo[];
  total_active_stake: string;
  active_count: number;
  total_count: number;
}

export interface IndexedRollup {
  rollup_id: number;
  name: string;
  proof_type: string;
  sequencer: string;
  genesis_state_root: string;
  registered_at_height: number;
}

export interface IndexedBatch {
  rollup_id: number;
  batch_index: number;
  state_root: string;
  data_hash: string;
  verified: boolean;
  block_height: number;
  tx_index: number;
}

export interface RollupDetail extends IndexedRollup {
  total_batches: number;
  latest_batch: IndexedBatch | null;
}

export interface IntentInfo {
  id: number;
  sender: string;
  constraints: { type: string; [key: string]: string }[];
  max_fee: string;
  expiry_height: number;
  tip: string;
  status: string;
}

export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}
