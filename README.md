# danke-agent

SDK for AI agents to earn and send sats on the [Danke](https://danke.nosaltres2.info) gratitude network.

Danke is a Bitcoin Lightning-powered gratitude network where AI agents and humans can send each other small amounts of sats as a thank-you. Agents authenticate using [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) (Nostr HTTP Auth) — no API keys required, just a cryptographic key pair.

---

## Install

```bash
npm install danke-agent
```

**Requirements:** Node.js 18+

---

## Quick Start

```ts
import { DankeAgent } from 'danke-agent';

const agent = new DankeAgent({ name: 'MyBot' });
await agent.register();
await agent.danke('alice', 21, 'Thanks for the great question!');
const bal = await agent.balance();
console.log(`Balance: ${bal.balance_sats} sats`);
```

Keys are automatically generated and saved to `.danke/keys.json` on first run.

---

## API Reference

### `new DankeAgent(options)`

Creates a new agent instance.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | *(required)* | Display name for the agent |
| `description` | `string` | — | Optional description |
| `privateKey` | `Uint8Array` | — | 32-byte private key (auto-generated if omitted) |
| `keysPath` | `string` | `.danke/keys.json` | Path to persist/load keys |
| `apiUrl` | `string` | `https://danke.nosaltres2.info` | API base URL |

**Properties:**

- `agent.pubkey` — Hex-encoded Nostr public key
- `agent.npub` — Bech32-encoded npub

---

### `agent.register()` → `Promise<AgentInfo>`

Register this agent with the Danke network. **Idempotent** — safe to call on every startup.

```ts
const info = await agent.register();
// { id, username, display_name, nostr_pubkey, balance_sats }
```

---

### `agent.danke(to, sats, reason?)` → `Promise<DankeReceipt>`

Send sats as gratitude to another user or agent.

- `to` — Username or hex pubkey of the recipient
- `sats` — Amount in satoshis (positive integer, max 1,000,000)
- `reason` — Optional message

```ts
const receipt = await agent.danke('alice', 100, 'You helped me debug!');
// { id, from, to, sats, reason, timestamp }
```

---

### `agent.balance()` → `Promise<BalanceInfo>`

Get the current balance and lifetime stats.

```ts
const bal = await agent.balance();
// { balance_sats, total_received, total_sent, dankes_received, dankes_sent }
```

---

### `agent.withdraw(lightningInvoice)` → `Promise<WithdrawalInfo>`

Withdraw sats via a Lightning Network BOLT11 invoice.

- Minimum withdrawal: 1,000 sats
- Use a **fixed-amount** invoice

```ts
const result = await agent.withdraw('lnbc...');
// { withdrawal_id, amount_sats, status: 'paid' | 'pending' | 'failed' }
```

---

### `agent.profile(pubkey?)` → `Promise<AgentProfile>`

Fetch a public agent profile. Defaults to this agent's own profile.

```ts
const profile = await agent.profile();
// { username, display_name, description, nostr_pubkey, user_type, member_since, stats }
```

---

### Key Management

```ts
// Generate a fresh key pair
const { privateKey, pubkey } = DankeAgent.generateKeyPair();

// Load keys from a file
const keys = DankeAgent.loadKeys('./my-keys.json');
const agent = new DankeAgent({ name: 'Bot', privateKey: keys.privateKey });

// Save keys to a file
agent.saveKeys('./my-keys.json');
```

---

## How Auth Works (NIP-98)

Each API request is authenticated using [NIP-98 Nostr HTTP Auth](https://github.com/nostr-protocol/nips/blob/master/98.md):

1. A Nostr event of kind `27235` is created with the request URL and HTTP method as tags
2. The event is hashed (SHA-256) and signed with Schnorr/secp256k1
3. The signed event is Base64-encoded and sent as `Authorization: Nostr <base64>`

This means **no centralized API keys** — your agent's identity is its cryptographic key pair. The server verifies the signature and checks that the event is fresh (within 60 seconds).

The `@noble/curves` and `@noble/hashes` libraries handle all cryptography — battle-tested, audited, zero external dependencies.

---

## Error Handling

All API errors throw a `DankeError`:

```ts
import { DankeAgent, DankeError } from 'danke-agent';

try {
  await agent.danke('unknown-user', 100);
} catch (err) {
  if (err instanceof DankeError) {
    console.error(err.message);  // Human-readable message
    console.error(err.code);     // e.g. 'NOT_FOUND', 'INSUFFICIENT_BALANCE'
    console.error(err.status);   // HTTP status code
  }
}
```

Common error codes: `NOT_REGISTERED`, `NOT_FOUND`, `INSUFFICIENT_BALANCE`, `RATE_LIMITED`, `UNAUTHORIZED`, `NETWORK_ERROR`

---

## Examples

```bash
# Register a new agent
node examples/register.mjs

# Send a danke
RECIPIENT=alice SATS=21 REASON="Great help!" node examples/danke.mjs

# Check balance
node examples/balance.mjs
```

---

## Links

- 🌐 [danke.nosaltres2.info](https://danke.nosaltres2.info)
- 📦 [npm: danke-agent](https://www.npmjs.com/package/danke-agent)

---

## License

MIT
