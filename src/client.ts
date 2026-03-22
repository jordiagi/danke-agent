import { schnorr } from '@noble/curves/secp256k1';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { buildNostrAuthHeader } from './auth.js';
import { bytesToHex, hexToBytes, pubkeyToNpub } from './utils.js';
import type {
  DankeAgentOptions,
  AgentInfo,
  DankeReceipt,
  BalanceInfo,
  WithdrawalInfo,
  AgentProfile,
  KeysFile,
} from './types.js';

const DEFAULT_API_URL = 'https://danke.nosaltres2.info';
const DEFAULT_KEYS_PATH = '.danke/keys.json';

/**
 * Error thrown when the Danke API returns a non-OK response.
 */
export class DankeError extends Error {
  /** Machine-readable error code from the API */
  code: string;
  /** HTTP status code */
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'DankeError';
    this.code = code;
    this.status = status;
  }
}

/**
 * DankeAgent — SDK client for AI agents to interact with the Danke API.
 *
 * @example
 * ```ts
 * const agent = new DankeAgent({ name: 'MyBot' });
 * await agent.register();
 * await agent.danke('alice', 100, 'Thanks for the help!');
 * ```
 */
export class DankeAgent {
  /** Hex-encoded Nostr public key */
  readonly pubkey: string;
  /** Bech32-encoded npub */
  readonly npub: string;

  private readonly privateKey: Uint8Array;
  private readonly apiUrl: string;
  private readonly name: string;
  private readonly description?: string;
  private readonly keysPath: string;

  constructor(options: DankeAgentOptions) {
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.name = options.name;
    this.description = options.description;
    this.keysPath = options.keysPath ?? DEFAULT_KEYS_PATH;

    if (options.privateKey) {
      this.privateKey = options.privateKey;
      const pubkeyBytes = schnorr.getPublicKey(this.privateKey);
      this.pubkey = bytesToHex(pubkeyBytes);
    } else {
      // Try to load from keysPath, otherwise generate
      const loaded = this._tryLoadKeys();
      if (loaded) {
        this.privateKey = loaded.privateKey;
        this.pubkey = loaded.pubkey;
      } else {
        const kp = DankeAgent.generateKeyPair();
        this.privateKey = kp.privateKey;
        this.pubkey = kp.pubkey;
        this._persistKeys();
      }
    }

    this.npub = pubkeyToNpub(this.pubkey);
  }

  // ─── Key Management ─────────────────────────────────────────────────────────

  /**
   * Generate a fresh Nostr key pair.
   */
  static generateKeyPair(): { privateKey: Uint8Array; pubkey: string } {
    // Generate 32 random bytes for the private key
    const privateKey = schnorr.utils.randomPrivateKey();
    const pubkeyBytes = schnorr.getPublicKey(privateKey);
    return { privateKey, pubkey: bytesToHex(pubkeyBytes) };
  }

  /**
   * Load keys from a JSON file on disk.
   *
   * @param path - Path to the keys JSON file
   * @returns Key pair `{ privateKey, pubkey }`
   * @throws If the file doesn't exist or is malformed
   */
  static loadKeys(path: string): { privateKey: Uint8Array; pubkey: string } {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as KeysFile;
    if (!data.privateKey || !data.pubkey) {
      throw new Error(`Invalid keys file at ${path}`);
    }
    return {
      privateKey: hexToBytes(data.privateKey),
      pubkey: data.pubkey,
    };
  }

  /**
   * Persist this agent's keys to disk.
   *
   * @param path - Optional override path (defaults to `keysPath` from constructor)
   */
  saveKeys(path?: string): void {
    const target = path ?? this.keysPath;
    const dir = dirname(target);
    mkdirSync(dir, { recursive: true });
    const data: KeysFile = {
      privateKey: bytesToHex(this.privateKey),
      pubkey: this.pubkey,
      created: new Date().toISOString(),
    };
    writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
  }

  private _tryLoadKeys(): { privateKey: Uint8Array; pubkey: string } | null {
    try {
      if (!existsSync(this.keysPath)) return null;
      return DankeAgent.loadKeys(this.keysPath);
    } catch {
      return null;
    }
  }

  private _persistKeys(): void {
    try {
      this.saveKeys();
    } catch {
      // In environments where fs isn't available (e.g. browser), silently skip
    }
  }

  // ─── HTTP Helpers ────────────────────────────────────────────────────────────

  private _authHeader(url: string, method: string): string {
    return buildNostrAuthHeader(url, method, this.privateKey, this.pubkey);
  }

  private async _request<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this._authHeader(url, method),
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new DankeError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR',
        0
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new DankeError(
        `Invalid JSON response from server (HTTP ${response.status})`,
        'INVALID_RESPONSE',
        response.status
      );
    }

    if (!response.ok) {
      const errData = data as { error?: string; code?: string };
      throw new DankeError(
        errData.error ?? `Request failed with status ${response.status}`,
        errData.code ?? 'API_ERROR',
        response.status
      );
    }

    return data as T;
  }

  // ─── Core API Methods ────────────────────────────────────────────────────────

  /**
   * Register this agent with the Danke network.
   * This method is idempotent — safe to call multiple times.
   *
   * @returns Agent info including username and balance
   */
  async register(): Promise<AgentInfo> {
    const result = await this._request<{ agent: AgentInfo }>(
      '/api/agent/register',
      'POST',
      {
        name: this.name,
        description: this.description,
      }
    );
    return result.agent;
  }

  /**
   * Send sats as a gratitude ("danke") to another user or agent.
   *
   * @param to - Username or hex pubkey of the recipient
   * @param sats - Amount in satoshis (must be a positive integer)
   * @param reason - Optional message explaining the gratitude
   * @returns Receipt of the danke transaction
   */
  async danke(to: string, sats: number, reason?: string): Promise<DankeReceipt> {
    const result = await this._request<{ danke: DankeReceipt }>(
      '/api/agent/danke',
      'POST',
      { to, sats, reason }
    );
    return result.danke;
  }

  /**
   * Get the current balance and stats for this agent.
   *
   * @returns Balance information including received/sent totals
   */
  async balance(): Promise<BalanceInfo> {
    return this._request<BalanceInfo>('/api/agent/balance', 'GET');
  }

  /**
   * Withdraw sats via a Lightning Network invoice.
   *
   * @param lightningInvoice - A valid BOLT11 Lightning invoice with a fixed amount
   * @returns Withdrawal status information
   */
  async withdraw(lightningInvoice: string): Promise<WithdrawalInfo> {
    const result = await this._request<WithdrawalInfo>(
      '/api/agent/withdraw',
      'POST',
      { lightning_invoice: lightningInvoice }
    );
    return result;
  }

  /**
   * Fetch the public profile for an agent.
   *
   * @param pubkey - Hex pubkey to look up (defaults to this agent's pubkey)
   * @returns Agent profile with stats
   */
  async profile(pubkey?: string): Promise<AgentProfile> {
    const target = pubkey ?? this.pubkey;
    const result = await this._request<{ agent: Omit<AgentProfile, 'stats'>; stats: AgentProfile['stats'] }>(
      `/api/agent/profile/${target}`,
      'GET'
    );
    return { ...result.agent, stats: result.stats };
  }
}
