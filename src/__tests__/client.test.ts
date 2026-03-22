import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DankeAgent, DankeError } from '../client.js';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'danke-agent-test-'));
}

function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function createAgent(options: Partial<ConstructorParameters<typeof DankeAgent>[0]> = {}): DankeAgent {
  return new DankeAgent({
    name: 'Test Agent',
    privateKey: DankeAgent.generateKeyPair().privateKey,
    ...options,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DankeAgent constructor', () => {
  it('generates keys and persists them when no file exists', () => {
    const dir = createTempDir();
    const keysPath = join(dir, 'keys.json');

    try {
      const agent = new DankeAgent({ name: 'Generated Agent', keysPath });
      const saved = JSON.parse(readFileSync(keysPath, 'utf8')) as {
        privateKey: string;
        pubkey: string;
        created: string;
      };

      expect(agent.pubkey).toMatch(/^[0-9a-f]{64}$/);
      expect(agent.npub).toMatch(/^npub1/);
      expect(saved.privateKey).toMatch(/^[0-9a-f]{64}$/);
      expect(saved.pubkey).toBe(agent.pubkey);
      expect(Number.isNaN(Date.parse(saved.created))).toBe(false);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('loads keys from file and derives pubkey from private key instead of trusting the stored pubkey', () => {
    const dir = createTempDir();
    const keysPath = join(dir, 'keys.json');
    const original = createAgent();

    try {
      original.saveKeys(keysPath);

      const saved = JSON.parse(readFileSync(keysPath, 'utf8')) as {
        privateKey: string;
        pubkey: string;
        created: string;
      };
      saved.pubkey = 'f'.repeat(64);
      writeFileSync(keysPath, JSON.stringify(saved, null, 2), 'utf8');

      const loaded = new DankeAgent({ name: 'Loaded Agent', keysPath });

      expect(loaded.pubkey).toBe(original.pubkey);
      expect(loaded.pubkey).not.toBe(saved.pubkey);
      expect(loaded.npub).toBe(original.npub);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('throws when the keys file is corrupt', () => {
    const dir = createTempDir();
    const keysPath = join(dir, 'keys.json');

    try {
      writeFileSync(keysPath, '{not json', 'utf8');

      expect(() => new DankeAgent({ name: 'Broken Agent', keysPath })).toThrow();
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('strips trailing slashes from apiUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const agent = createAgent({ apiUrl: 'https://api.example.com///' });

    await (agent as any)._request('/health', 'GET');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/health',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('danke()', () => {
  it.each([NaN, -1, 0, 1.5])('rejects invalid sats: %s', async (sats) => {
    const agent = createAgent();
    const requestSpy = vi.spyOn(agent as any, '_request');

    await expect(agent.danke('alice', sats)).rejects.toMatchObject({
      name: 'DankeError',
      code: 'INVALID_SATS',
      status: 400,
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it.each([1, 21])('accepts valid positive integer sats: %s', async (sats) => {
    const agent = createAgent();
    const receipt = {
      id: 'danke_123',
      from: 'tester',
      to: 'alice',
      sats,
      reason: 'thanks',
      timestamp: 1710000000,
    };
    const requestSpy = vi
      .spyOn(agent as any, '_request')
      .mockResolvedValue({ danke: receipt });

    await expect(agent.danke('alice', sats, 'thanks')).resolves.toEqual(receipt);
    expect(requestSpy).toHaveBeenCalledWith('/api/agent/danke', 'POST', {
      to: 'alice',
      sats,
      reason: 'thanks',
    });
  });
});

describe('_request()', () => {
  it('returns null for 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const agent = createAgent();

    await expect((agent as any)._request('/empty', 'GET')).resolves.toBeNull();
  });

  it('includes a body preview when the server returns a non-JSON response', async () => {
    const preview = 'Bad gateway from upstream proxy';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(preview, { status: 502, statusText: 'Bad Gateway' }))
    );
    const agent = createAgent();

    await expect((agent as any)._request('/broken', 'GET')).rejects.toMatchObject({
      name: 'DankeError',
      code: 'INVALID_RESPONSE',
      status: 502,
      message: expect.stringContaining(preview),
    });
  });

  it('parses valid JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ balance_sats: 123 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const agent = createAgent();

    await expect((agent as any)._request('/api/agent/balance', 'GET')).resolves.toEqual({
      balance_sats: 123,
    });
  });

  it('throws DankeError for API errors returned as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'insufficient balance', code: 'INSUFFICIENT_FUNDS' }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const agent = createAgent();

    await expect((agent as any)._request('/api/agent/danke', 'POST', { sats: 100 })).rejects.toMatchObject(
      {
        name: 'DankeError',
        message: 'insufficient balance',
        code: 'INSUFFICIENT_FUNDS',
        status: 402,
      }
    );
  });
});

describe('loadKeys()', () => {
  it('rejects files missing privateKey', () => {
    const dir = createTempDir();
    const keysPath = join(dir, 'keys.json');

    try {
      writeFileSync(keysPath, JSON.stringify({ pubkey: 'f'.repeat(64) }), 'utf8');

      expect(() => DankeAgent.loadKeys(keysPath)).toThrow(`Invalid keys file at ${keysPath}`);
    } finally {
      cleanupTempDir(dir);
    }
  });
});

describe('key persistence', () => {
  it('saveKeys writes the expected format and round-trips correctly', () => {
    const dir = createTempDir();
    const keysPath = join(dir, 'keys.json');
    const original = createAgent();

    try {
      original.saveKeys(keysPath);

      const saved = JSON.parse(readFileSync(keysPath, 'utf8')) as {
        privateKey: string;
        pubkey: string;
        created: string;
      };
      const reloaded = DankeAgent.loadKeys(keysPath);
      const fromDisk = new DankeAgent({ name: 'Reloaded Agent', keysPath });

      expect(saved).toEqual({
        privateKey: Buffer.from(reloaded.privateKey).toString('hex'),
        pubkey: original.pubkey,
        created: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(saved.created))).toBe(false);
      expect(fromDisk.pubkey).toBe(original.pubkey);
      expect(Buffer.from(reloaded.privateKey).toString('hex')).toBe(saved.privateKey);
    } finally {
      cleanupTempDir(dir);
    }
  });
});
