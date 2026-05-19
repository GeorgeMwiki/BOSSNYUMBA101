/**
 * C4 closure regression: `verifyAgentRequest` MUST sign with the raw
 * secret returned by `registry.resolveSecret`. The previous
 * implementation signed with `agent.hmacSecretHash` — incoherent (the
 * hash IS the effective secret).
 *
 * These tests assert:
 *   1. Signature changes when the RAW secret changes (the hash is
 *      identical because the test agent's `hmacSecretHash` is a fixed
 *      value — confirms the raw secret is what's signed).
 *   2. Signature is consistent for the same raw secret.
 *   3. Verifier rejects when `resolveSecret` returns null.
 *
 * Also covers H11 (replay-prevention nonce ledger).
 */

import { describe, it, expect } from 'vitest';
import {
  verifyAgentRequest,
  signRequest,
  hashApiKey,
  createInMemoryReplayLedger,
  type AgentRegistry,
} from '../agent-auth.js';
import type { RegisteredAgent } from '../types.js';

async function makeAgent(): Promise<RegisteredAgent> {
  return Object.freeze({
    id: 'agent-c4',
    name: 'C4 agent',
    description: 'test',
    ownerTenantId: 'tenant-c4',
    apiKeyPrefix: 'bnk_',
    apiKeyHash: await hashApiKey('plain'),
    // The stored hash is fixed across both verifier paths — the
    // test discriminator is the RAW secret returned by resolveSecret.
    hmacSecretHash: 'stored-hash-fixed',
    scopes: ['read:cases'],
    rateLimitRpm: 60,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    metadata: {},
  });
}

function makeRegistry(
  agent: RegisteredAgent,
  rawSecret: string,
): AgentRegistry {
  return {
    async findById(id) {
      return id === agent.id ? agent : null;
    },
    async touchLastSeen() {},
    async resolveSecret(id) {
      return id === agent.id ? rawSecret : null;
    },
  };
}

describe('agent-auth — C4: raw secret resolution', () => {
  it('verifies a signature signed with raw secret resolved via registry', async () => {
    const agent = await makeAgent();
    const rawSecret = 'raw-secret-A';
    const registry = makeRegistry(agent, rawSecret);

    const timestamp = Date.now();
    const body = '{"x":1}';
    const sig = await signRequest('POST', '/p', timestamp, body, rawSecret);

    const res = await verifyAgentRequest(
      { registry },
      {
        method: 'POST',
        path: '/p',
        body,
        headers: {
          'x-agent-id': agent.id,
          'x-agent-timestamp': String(timestamp),
          'x-agent-signature': sig,
        },
      },
    );
    expect(res.ok).toBe(true);
  });

  it('rejects when the signing secret differs from the registry-resolved secret', async () => {
    const agent = await makeAgent();
    const rawSecret = 'raw-secret-A';
    const otherSecret = 'raw-secret-B';
    const registry = makeRegistry(agent, rawSecret);

    const timestamp = Date.now();
    const body = '{"x":1}';
    // Caller signs with B; verifier signs with A → mismatch.
    const sig = await signRequest('POST', '/p', timestamp, body, otherSecret);

    const res = await verifyAgentRequest(
      { registry },
      {
        method: 'POST',
        path: '/p',
        body,
        headers: {
          'x-agent-id': agent.id,
          'x-agent-timestamp': String(timestamp),
          'x-agent-signature': sig,
        },
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('AUTH_INVALID_SIGNATURE');
  });

  it('rejects when resolveSecret returns null (KMS unavailable)', async () => {
    const agent = await makeAgent();
    const registry: AgentRegistry = {
      async findById(id) {
        return id === agent.id ? agent : null;
      },
      async touchLastSeen() {},
      async resolveSecret() {
        return null;
      },
    };
    const timestamp = Date.now();
    const sig = await signRequest('POST', '/p', timestamp, '{}', 'whatever');
    const res = await verifyAgentRequest(
      { registry },
      {
        method: 'POST',
        path: '/p',
        body: '{}',
        headers: {
          'x-agent-id': agent.id,
          'x-agent-timestamp': String(timestamp),
          'x-agent-signature': sig,
        },
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('AUTH_INVALID_KEY');
  });

  it('signature CHANGES when the raw secret changes (regression for hash-as-key bug)', async () => {
    const t = 1_700_000_000_000;
    const body = '{"x":1}';
    const sig1 = await signRequest('POST', '/p', t, body, 'secret-A');
    const sig2 = await signRequest('POST', '/p', t, body, 'secret-B');
    expect(sig1).not.toBe(sig2);
  });

  it('signature is STABLE for the same raw secret', async () => {
    const t = 1_700_000_000_000;
    const body = '{"x":1}';
    const sig1 = await signRequest('POST', '/p', t, body, 'secret-A');
    const sig2 = await signRequest('POST', '/p', t, body, 'secret-A');
    expect(sig1).toBe(sig2);
  });
});

describe('agent-auth — H11: replay prevention ledger', () => {
  it('rejects a second presentation of the same signature within the drift window', async () => {
    const agent = await makeAgent();
    const rawSecret = 'raw-secret-replay';
    const registry = makeRegistry(agent, rawSecret);
    const replayLedger = createInMemoryReplayLedger();
    const timestamp = Date.now();
    const body = '{"x":1}';
    const sig = await signRequest('POST', '/p', timestamp, body, rawSecret);

    const headers = {
      'x-agent-id': agent.id,
      'x-agent-timestamp': String(timestamp),
      'x-agent-signature': sig,
    };
    const first = await verifyAgentRequest(
      { registry, replayLedger },
      { method: 'POST', path: '/p', body, headers },
    );
    expect(first.ok).toBe(true);

    const second = await verifyAgentRequest(
      { registry, replayLedger },
      { method: 'POST', path: '/p', body, headers },
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.errorCode).toBe('AUTH_REPLAY_DETECTED');
  });

  it('without a ledger, replays are accepted (legacy behaviour)', async () => {
    const agent = await makeAgent();
    const rawSecret = 'raw-secret-noledger';
    const registry = makeRegistry(agent, rawSecret);
    const timestamp = Date.now();
    const body = '{"x":1}';
    const sig = await signRequest('POST', '/p', timestamp, body, rawSecret);
    const headers = {
      'x-agent-id': agent.id,
      'x-agent-timestamp': String(timestamp),
      'x-agent-signature': sig,
    };
    const first = await verifyAgentRequest(
      { registry },
      { method: 'POST', path: '/p', body, headers },
    );
    const second = await verifyAgentRequest(
      { registry },
      { method: 'POST', path: '/p', body, headers },
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });
});
