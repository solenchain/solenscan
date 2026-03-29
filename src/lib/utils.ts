export function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatGas(gas: number): string {
  if (gas >= 1_000_000) return `${(gas / 1_000_000).toFixed(2)}M`;
  if (gas >= 1_000) return `${(gas / 1_000).toFixed(1)}K`;
  return gas.toString();
}

const DECIMALS = 8;
const DIVISOR = BigInt(10 ** DECIMALS);

export function formatBalance(raw: string | number): string {
  const n = typeof raw === "string" ? BigInt(raw) : BigInt(raw);
  const whole = n / DIVISOR;
  const frac = n % DIVISOR;
  if (frac === BigInt(0)) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

export interface TransferInfo {
  to: string;
  amount: string;
}

export function parseTransferEvent(data: string): TransferInfo | null {
  // Transfer event data: [recipient_id (32 bytes = 64 hex chars)][amount (16 bytes = 32 hex chars)]
  if (data.length < 96) return null;
  const to = data.slice(0, 64);
  const amountHex = data.slice(64, 96);
  // Amount is little-endian u128
  const bytes = [];
  for (let i = 0; i < amountHex.length; i += 2) {
    bytes.push(parseInt(amountHex.slice(i, i + 2), 16));
  }
  // Convert LE bytes to bigint
  let amount = BigInt(0);
  for (let i = bytes.length - 1; i >= 0; i--) {
    amount = (amount << BigInt(8)) | BigInt(bytes[i]);
  }
  return { to, amount: amount.toString() };
}

export function getTransferInfo(events: { topic: string; data: string }[]): TransferInfo | null {
  const transferEvent = events.find((e) => e.topic === "transfer");
  if (!transferEvent) return null;
  return parseTransferEvent(transferEvent.data);
}

export interface RewardInfo {
  validator: string;
  amount: string;
}

export function parseRewardEvent(data: string): RewardInfo | null {
  // Epoch reward data: [validator_id (32 bytes = 64 hex chars)][amount (16 bytes = 32 hex chars)]
  if (data.length < 96) return null;
  const validator = data.slice(0, 64);
  const amountHex = data.slice(64, 96);
  const bytes = [];
  for (let i = 0; i < amountHex.length; i += 2) {
    bytes.push(parseInt(amountHex.slice(i, i + 2), 16));
  }
  let amount = BigInt(0);
  for (let i = bytes.length - 1; i >= 0; i--) {
    amount = (amount << BigInt(8)) | BigInt(bytes[i]);
  }
  return { validator, amount: amount.toString() };
}

export function isContractAccount(codeHash: string): boolean {
  return codeHash !== "0".repeat(64) && codeHash !== "";
}

export function classNames(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
