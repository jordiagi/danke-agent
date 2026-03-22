/**
 * Options for constructing a DankeAgent instance.
 */
export interface DankeAgentOptions {
  /** Display name for this agent (used on registration) */
  name: string;
  /** Optional description of what this agent does */
  description?: string;
  /** Private key as raw bytes. If omitted, keys are loaded or generated. */
  privateKey?: Uint8Array;
  /** Path to persist/load keys (default: `.danke/keys.json`) */
  keysPath?: string;
  /** Danke API base URL (default: `https://danke.nosaltres2.info`) */
  apiUrl?: string;
}

/** Returned after registering an agent */
export interface AgentInfo {
  id: string;
  username: string;
  display_name: string;
  nostr_pubkey: string;
  balance_sats: number;
}

/** Returned after sending a danke */
export interface DankeReceipt {
  id: string;
  from: string;
  to: string;
  sats: number;
  reason?: string;
  timestamp: number;
}

/** Agent balance and stats */
export interface BalanceInfo {
  balance_sats: number;
  total_received: number;
  total_sent: number;
  dankes_received: number;
  dankes_sent: number;
}

/** Returned after initiating a Lightning withdrawal */
export interface WithdrawalInfo {
  withdrawal_id: string;
  amount_sats: number;
  status: 'pending' | 'paid' | 'failed';
}

/** Public profile of an agent */
export interface AgentProfile {
  username: string;
  display_name: string;
  description?: string;
  nostr_pubkey: string;
  user_type: string;
  member_since: number;
  stats: {
    dankes_received: number;
    dankes_sent: number;
    sats_received: number;
    sats_sent: number;
    balance_sats: number;
  };
}

/** Persisted keys file format */
export interface KeysFile {
  privateKey: string; // hex
  pubkey: string;     // hex
  created: string;    // ISO date string
}
