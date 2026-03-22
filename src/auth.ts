import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from './utils.js';

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Compute the Nostr event ID: SHA-256 of the canonical serialization.
 * [0, pubkey, created_at, kind, tags, content]
 */
function computeEventId(
  pubkey: string,
  created_at: number,
  kind: number,
  tags: string[][],
  content: string
): Uint8Array {
  const serialized = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
  return sha256(new TextEncoder().encode(serialized));
}

/**
 * Build a NIP-98 HTTP Auth header for the given URL and HTTP method.
 *
 * @param url - Full request URL
 * @param method - HTTP method (GET, POST, etc.)
 * @param privateKey - 32-byte private key
 * @param pubkey - Hex-encoded public key
 * @param bodyHash - Optional SHA-256 hash of the request body (hex). Added as `payload` tag for POST/PUT.
 * @returns `Authorization` header value: `Nostr <base64>`
 */
export function buildNostrAuthHeader(
  url: string,
  method: string,
  privateKey: Uint8Array,
  pubkey: string,
  bodyHash?: string
): string {
  const created_at = Math.floor(Date.now() / 1000);
  const kind = 27235;
  const tags: string[][] = [
    ['u', url],
    ['method', method.toUpperCase()],
  ];
  // Include payload hash for body-bearing requests (NIP-98 spec)
  if (bodyHash) {
    tags.push(['payload', bodyHash]);
  }
  const content = '';

  const idBytes = computeEventId(pubkey, created_at, kind, tags, content);
  const id = bytesToHex(idBytes);

  const sigBytes = schnorr.sign(idBytes, privateKey);
  const sig = bytesToHex(sigBytes);

  const event: NostrEvent = {
    id,
    pubkey,
    created_at,
    kind,
    tags,
    content,
    sig,
  };

  const encoded = Buffer.from(JSON.stringify(event)).toString('base64');
  return `Nostr ${encoded}`;
}
