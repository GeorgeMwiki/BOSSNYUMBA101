/**
 * File checkpointing — Phase K-A regression suite.
 *
 * Covers R1 parity gap #4 acceptance criteria:
 *
 *   * write a file → take a checkpoint → write more → rewind →
 *     confirm earlier content
 *   * branch: rewind by N messages preserves the intermediate
 *     state correctly
 *   * diff: the snapshot store carries the BEFORE bytes per write
 *
 * The checkpoint module is wired to a SessionStore — the test uses
 * the in-memory store from `../../session-store/in-memory-session-store.js`
 * to keep the suite fast and dependency-free.
 */

import { describe, it, expect } from 'vitest';
import {
  createFileCheckpointer,
  createInMemoryFileStore,
} from '../file-checkpoint.js';
import { createInMemorySessionStore } from '../../session-store/in-memory-session-store.js';

function makeWiring(): {
  fileStore: ReturnType<typeof createInMemoryFileStore>;
  sessionStore: ReturnType<typeof createInMemorySessionStore>;
  checkpointer: ReturnType<typeof createFileCheckpointer>;
} {
  const fileStore = createInMemoryFileStore({ '/a.md': 'original A' });
  const sessionStore = createInMemorySessionStore();
  let counter = 0;
  const checkpointer = createFileCheckpointer({
    fileStore,
    sessionStore,
    uuid: () => `cp_${(counter += 1)}`,
  });
  return { fileStore, sessionStore, checkpointer };
}

describe('FileCheckpointer — basic rewind', () => {
  it('rewind restores the BEFORE content of a single file', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_basic';

    // Message 1 — take a checkpoint, then write /a.md.
    const cp1 = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp1, '/a.md', 'edited by msg1');
    await fileStore.write('/a.md', 'edited by msg1');

    // Message 2 — write again.
    const cp2 = await checkpointer.beginMessage(sessionId, [cp1]);
    await checkpointer.recordFileWrite(sessionId, cp2, '/a.md', 'edited by msg2');
    await fileStore.write('/a.md', 'edited by msg2');

    // Rewind back to BEFORE message 2 (i.e. to cp1's state).
    const restored = await checkpointer.rewindFiles(sessionId, cp1);
    expect(restored).toContain('/a.md');
    expect(await fileStore.read('/a.md')).toBe('edited by msg1');
  });

  it('rewind restores a created file by deleting it', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_create';

    const cp0 = await checkpointer.beginMessage(sessionId, []);
    // /b.md does not exist before this write.
    await checkpointer.recordFileWrite(sessionId, cp0, '/b.md', 'created');
    await fileStore.write('/b.md', 'created');

    const cp1 = await checkpointer.beginMessage(sessionId, [cp0]);
    await checkpointer.recordFileWrite(sessionId, cp1, '/b.md', 'edited');
    await fileStore.write('/b.md', 'edited');

    await checkpointer.rewindFiles(sessionId, cp0);
    expect(await fileStore.read('/b.md')).toBe('created');

    // Now rewind past the create — file should vanish.
    const cpInit = await checkpointer.beginMessage('sess_create_2', []);
    await checkpointer.recordFileWrite('sess_create_2', cpInit, '/c.md', 'first');
    await fileStore.write('/c.md', 'first');
    const cpFollow = await checkpointer.beginMessage('sess_create_2', [cpInit]);
    await checkpointer.recordFileWrite('sess_create_2', cpFollow, '/d.md', 'newfile');
    await fileStore.write('/d.md', 'newfile');
    await checkpointer.rewindFiles('sess_create_2', cpInit);
    expect(await fileStore.read('/d.md')).toBeNull();
  });

  it('rewind across multiple checkpoints walks newest-first', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_chain';

    const cp1 = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp1, '/a.md', 'v1');
    await fileStore.write('/a.md', 'v1');

    const cp2 = await checkpointer.beginMessage(sessionId, [cp1]);
    await checkpointer.recordFileWrite(sessionId, cp2, '/a.md', 'v2');
    await fileStore.write('/a.md', 'v2');

    const cp3 = await checkpointer.beginMessage(sessionId, [cp1, cp2]);
    await checkpointer.recordFileWrite(sessionId, cp3, '/a.md', 'v3');
    await fileStore.write('/a.md', 'v3');

    // Rewind from v3 → cp1 should give us v1 (the BEFORE of cp1's
    // write, applied transitively newest-first).
    const restored = await checkpointer.rewindFiles(sessionId, cp1);
    expect(restored).toContain('/a.md');
    expect(await fileStore.read('/a.md')).toBe('v1');
  });
});

describe('FileCheckpointer — diff + branch', () => {
  it('captures BEFORE bytes per write (diff)', async () => {
    const { checkpointer } = makeWiring();
    const sessionId = 'sess_diff';
    const cp = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp, '/a.md', 'new content');
    const stored = await checkpointer.getCheckpoint(sessionId, cp);
    expect(stored?.entries.length).toBe(1);
    expect(stored?.entries[0]?.previousContent).toBe('original A');
    expect(stored?.entries[0]?.nextContent).toBe('new content');
  });

  it('rewind drops newer checkpoints from the index (branch off)', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_branch';

    const cp1 = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp1, '/a.md', 'v1');
    await fileStore.write('/a.md', 'v1');

    const cp2 = await checkpointer.beginMessage(sessionId, [cp1]);
    await checkpointer.recordFileWrite(sessionId, cp2, '/a.md', 'v2');
    await fileStore.write('/a.md', 'v2');

    await checkpointer.rewindFiles(sessionId, cp1);

    // The post-rewind list should have ONLY cp1.
    const list = await checkpointer.listCheckpoints(sessionId);
    expect(list.map((c) => c.checkpointUuid)).toEqual([cp1]);
    // cp2 should no longer be readable.
    expect(await checkpointer.getCheckpoint(sessionId, cp2)).toBeNull();
  });

  it('multiple files restored in the same rewind', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_multi';

    const cp1 = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp1, '/a.md', 'a-v1');
    await fileStore.write('/a.md', 'a-v1');
    await checkpointer.recordFileWrite(sessionId, cp1, '/b.md', 'b-v1');
    await fileStore.write('/b.md', 'b-v1');

    const cp2 = await checkpointer.beginMessage(sessionId, [cp1]);
    await checkpointer.recordFileWrite(sessionId, cp2, '/a.md', 'a-v2');
    await fileStore.write('/a.md', 'a-v2');
    await checkpointer.recordFileWrite(sessionId, cp2, '/b.md', 'b-v2');
    await fileStore.write('/b.md', 'b-v2');

    const restored = await checkpointer.rewindFiles(sessionId, cp1);
    expect(restored.sort()).toEqual(['/a.md', '/b.md']);
    expect(await fileStore.read('/a.md')).toBe('a-v1');
    expect(await fileStore.read('/b.md')).toBe('b-v1');
  });

  it('rewind is idempotent on the target checkpoint', async () => {
    const { fileStore, checkpointer } = makeWiring();
    const sessionId = 'sess_idem';
    const cp1 = await checkpointer.beginMessage(sessionId, []);
    await checkpointer.recordFileWrite(sessionId, cp1, '/a.md', 'v1');
    await fileStore.write('/a.md', 'v1');

    // Rewind to cp1 when there are no later checkpoints.
    const restored = await checkpointer.rewindFiles(sessionId, cp1);
    expect(restored.length).toBe(0);
    expect(await fileStore.read('/a.md')).toBe('v1');
  });

  it('rewind throws when the target checkpoint is unknown', async () => {
    const { checkpointer } = makeWiring();
    const sessionId = 'sess_err';
    await expect(checkpointer.rewindFiles(sessionId, 'never-issued')).rejects.toThrow(
      /unknown checkpoint/,
    );
  });

  it('recordFileWrite throws when the checkpoint is unknown', async () => {
    const { checkpointer } = makeWiring();
    await expect(
      checkpointer.recordFileWrite('sess_x', 'never', '/a.md', 'x'),
    ).rejects.toThrow(/no active checkpoint/);
  });
});

describe('FileCheckpointer — durability composition', () => {
  it('checkpoints survive a logical session-store reload', async () => {
    // Simulate a worker restart by detaching the checkpointer from its
    // file store but keeping the SAME SessionStore — production wiring
    // uses Redis/Postgres so the snapshots persist across boots.
    const sessionStore = createInMemorySessionStore();
    const fileStore1 = createInMemoryFileStore({ '/x.md': 'v0' });
    const cp = createFileCheckpointer({
      fileStore: fileStore1,
      sessionStore,
      uuid: (
        () => {
          let n = 0;
          return (): string => `cp_${(n += 1)}`;
        }
      )(),
    });
    const sessionId = 'sess_dur';
    const cp1 = await cp.beginMessage(sessionId, []);
    await cp.recordFileWrite(sessionId, cp1, '/x.md', 'v1');
    await fileStore1.write('/x.md', 'v1');

    // "Restart" — fresh checkpointer with a fresh file store but same
    // sessionStore. Rewinding to cp1 should still know about /x.md and
    // restore the file state — although on a NEW file store, the
    // restore writes v0 (the previousContent) to the fresh store.
    const fileStore2 = createInMemoryFileStore();
    const cp2 = createFileCheckpointer({
      fileStore: fileStore2,
      sessionStore,
      uuid: (): string => 'unused',
    });
    const after = await cp2.beginMessage(sessionId, [cp1]);
    await cp2.recordFileWrite(sessionId, after, '/x.md', 'v2');
    await fileStore2.write('/x.md', 'v2');
    await cp2.rewindFiles(sessionId, cp1);
    // Restore wrote the previousContent of cp2 (which was v1, captured
    // from the fresh file store as null since /x.md didn't exist there).
    // The file should now be deleted.
    expect(await fileStore2.read('/x.md')).toBeNull();
  });
});
