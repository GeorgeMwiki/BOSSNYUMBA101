/**
 * Unit tests for the co-owner invite acceptance repo (blocker #6 fix).
 *
 * Covers the load-bearing correctness of the two new public auth routes'
 * backing logic (GET /auth/invite/:token, POST /auth/accept-invite):
 *   - classifyInvite: pending/expired/revoked/accepted/unknown classification,
 *     including the revoked-beats-expired ordering.
 *   - resolveInviteByToken: maps the joined row (org name + inviter name) and
 *     defaults a nameless inviter gracefully.
 *   - acceptInvite: provisions a NEW invitee (user insert + role upsert + role
 *     link + invite flip), and is IDEMPOTENT on replay (existing user → no
 *     re-insert, no password reset, role link DO-NOTHING).
 *
 * The DB is a recording stub: it pattern-matches the rendered SQL (operation +
 * target table) and returns canned rows, so the test is deterministic and needs
 * no live Postgres. We assert on the SEQUENCE of operations the repo emits.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyInvite,
  resolveInviteByToken,
  acceptInvite,
  type ResolvedInvite,
  type RepoDb,
} from '../invite-accept-repo';

// ---------------------------------------------------------------------------
// Recording SQL stub
// ---------------------------------------------------------------------------

interface RecordedOp {
  readonly op: string;
  readonly text: string;
}

/**
 * Render a drizzle `SQL` object to a lowercased string for matching. drizzle's
 * SQL carries its literal fragments on `queryChunks` (string parts) — we join
 * those; parameter values are irrelevant to operation detection.
 */
function renderSql(query: unknown): string {
  const q = query as { queryChunks?: unknown[] };
  if (Array.isArray(q.queryChunks)) {
    const parts = q.queryChunks
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk;
        const c = chunk as { value?: unknown };
        if (Array.isArray(c?.value)) return c.value.join('');
        return '';
      })
      .join(' ');
    return parts.toLowerCase();
  }
  return String(query).toLowerCase();
}

function detectOp(text: string): string {
  if (text.includes('from co_owner_invites') && text.includes('select')) return 'select_invite';
  if (text.includes('from users') && text.includes('select')) return 'select_user';
  if (text.includes('insert into users')) return 'insert_user';
  if (text.includes('insert into roles')) return 'upsert_role';
  if (text.includes('from roles') && text.includes('select')) return 'select_role';
  if (text.includes('insert into user_roles')) return 'link_role';
  if (text.includes('update co_owner_invites')) return 'flip_invite';
  return 'unknown';
}

function makeStub(responses: Partial<Record<string, Array<Record<string, unknown>[]>>>): {
  db: RepoDb;
  ops: RecordedOp[];
} {
  const ops: RecordedOp[] = [];
  const cursors: Record<string, number> = {};
  const db: RepoDb = {
    async execute(query: unknown) {
      const text = renderSql(query);
      const op = detectOp(text);
      ops.push({ op, text });
      const queue = responses[op];
      if (queue) {
        const idx = cursors[op] ?? 0;
        cursors[op] = idx + 1;
        return queue[idx] ?? [];
      }
      return [];
    },
  };
  return { db, ops };
}

const baseInvite: ResolvedInvite = {
  id: 'inv-1',
  tenantId: 'tn-1',
  email: 'invitee@example.com',
  firstName: 'Asha',
  lastName: 'Mwangi',
  role: 'CO_OWNER',
  properties: ['Sunrise Apartments'],
  status: 'pending',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  acceptedAt: null,
  revokedAt: null,
  invitedBy: 'owner-1',
  organizationName: 'Acme Holdings',
  inviterName: 'Boss Owner',
};

// ---------------------------------------------------------------------------
// classifyInvite — pure
// ---------------------------------------------------------------------------

describe('classifyInvite', () => {
  it('accepts a pending, non-expired, non-revoked invite (null)', () => {
    expect(classifyInvite(baseInvite)).toBeNull();
  });

  it('rejects an expired pending invite', () => {
    const expired = { ...baseInvite, expiresAt: new Date(Date.now() - 1000).toISOString() };
    expect(classifyInvite(expired)).toBe('expired');
  });

  it('rejects a revoked invite — revoked beats expired', () => {
    const revokedAndExpired = {
      ...baseInvite,
      revokedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(classifyInvite(revokedAndExpired)).toBe('revoked');
  });

  it('rejects an already-accepted invite', () => {
    expect(classifyInvite({ ...baseInvite, status: 'accepted' })).toBe('accepted');
  });

  it('treats an unknown status as not_found', () => {
    expect(classifyInvite({ ...baseInvite, status: 'frobnicated' })).toBe('not_found');
  });
});

// ---------------------------------------------------------------------------
// resolveInviteByToken
// ---------------------------------------------------------------------------

describe('resolveInviteByToken', () => {
  it('maps the joined row into the preview shape', async () => {
    const { db } = makeStub({
      select_invite: [[
        {
          id: 'inv-1',
          tenant_id: 'tn-1',
          email: 'invitee@example.com',
          first_name: 'Asha',
          last_name: 'Mwangi',
          role: 'VIEWER',
          property_access: ['Block A', 'Block B'],
          status: 'pending',
          expires_at: '2999-01-01T00:00:00.000Z',
          accepted_at: null,
          revoked_at: null,
          invited_by: 'owner-1',
          organization_name: 'Acme Holdings',
          inviter_first_name: 'Boss',
          inviter_last_name: 'Owner',
        },
      ]],
    });

    const invite = await resolveInviteByToken(db, 'a'.repeat(32));
    expect(invite).not.toBeNull();
    expect(invite?.organizationName).toBe('Acme Holdings');
    expect(invite?.inviterName).toBe('Boss Owner');
    expect(invite?.role).toBe('VIEWER');
    expect(invite?.properties).toEqual(['Block A', 'Block B']);
    expect(invite?.invitedBy).toBe('owner-1');
  });

  it('returns null when no row carries the token', async () => {
    const { db } = makeStub({ select_invite: [[]] });
    expect(await resolveInviteByToken(db, 'missing-token-1234567890')).toBeNull();
  });

  it('falls back to a generic inviter name when the inviter row is absent', async () => {
    const { db } = makeStub({
      select_invite: [[
        {
          id: 'inv-2',
          tenant_id: 'tn-1',
          email: 'x@example.com',
          first_name: '',
          last_name: '',
          role: 'VIEWER',
          property_access: '[]',
          status: 'pending',
          expires_at: null,
          accepted_at: null,
          revoked_at: null,
          invited_by: null,
          organization_name: null,
          inviter_first_name: null,
          inviter_last_name: null,
        },
      ]],
    });
    const invite = await resolveInviteByToken(db, 'b'.repeat(32));
    expect(invite?.inviterName).toBe('A BossNyumba owner');
    expect(invite?.organizationName).toBe('Your organization');
  });
});

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------

describe('acceptInvite', () => {
  it('provisions a NEW invitee: insert user → upsert role → link role → flip invite', async () => {
    const { db, ops } = makeStub({
      // First select_user (pre-insert lookup) → no user. Second (post-insert
      // race re-resolve) → the freshly inserted user.
      select_user: [[], [{ id: 'new-user-id' }]],
      upsert_role: [[{ id: 'role-id' }]],
    });

    const result = await acceptInvite(db, baseInvite, {
      firstName: 'Asha',
      lastName: 'Mwangi',
      passwordHash: 'hashed',
    });

    expect(result.email).toBe('invitee@example.com');
    expect(result.role).toBe('CO_OWNER');
    expect(result.organizationName).toBe('Acme Holdings');

    const sequence = ops.map((o) => o.op);
    expect(sequence).toContain('insert_user');
    expect(sequence).toContain('upsert_role');
    expect(sequence).toContain('link_role');
    expect(sequence).toContain('flip_invite');
    // Order invariant: user must exist before the role link is written.
    expect(sequence.indexOf('insert_user')).toBeLessThan(sequence.indexOf('link_role'));
    expect(sequence.indexOf('link_role')).toBeLessThan(sequence.indexOf('flip_invite'));
  });

  it('is idempotent on replay: existing user → NO insert, NO password reset', async () => {
    const { db, ops } = makeStub({
      // Pre-insert lookup finds the existing user → repo skips the insert.
      select_user: [[{ id: 'existing-user-id' }]],
      upsert_role: [[{ id: 'role-id' }]],
    });

    const result = await acceptInvite(db, { ...baseInvite, status: 'accepted' }, {
      firstName: 'Asha',
      lastName: 'Mwangi',
      passwordHash: 'a-new-hash-that-must-be-ignored',
    });

    expect(result.userId).toBe('existing-user-id');
    expect(result.created).toBe(false);

    const sequence = ops.map((o) => o.op);
    // Critical: no user insert on the idempotent path (no password reset).
    expect(sequence).not.toContain('insert_user');
    // Role link + invite flip still run (both DO-NOTHING / no-op safe).
    expect(sequence).toContain('link_role');
    expect(sequence).toContain('flip_invite');
  });
});
