/**
 * session-replay-storage — unit tests.
 *
 * Covers:
 *   1. LocalFileStorage.upload writes a file under rootDir + returns
 *      a file:// URI; download reads it back.
 *   2. LocalFileStorage refuses unsafe chunkIds (path traversal).
 *   3. LocalFileStorage download throws on missing file (no retry).
 *   4. selectSessionReplayStorage falls back to local when AWS env is
 *      not set OR @aws-sdk/client-s3 is missing.
 *   5. createS3Storage throws when the SDK is not installed (current
 *      workspace state) — composition root catches this and falls
 *      back to local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join as joinPath } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createLocalFileStorage,
  createS3Storage,
  selectSessionReplayStorage,
} from '../session-replay-storage';

const TEST_ROOT = joinPath(tmpdir(), `b5-session-replay-test-${process.pid}`);

describe('createLocalFileStorage', () => {
  beforeEach(async () => {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });
  afterEach(async () => {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('upload writes the file and returns a file:// URI', async () => {
    const store = createLocalFileStorage({ rootDir: TEST_ROOT });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const out = await store.upload({ chunkId: 'abc-123', gzipBytes: bytes });
    expect(out.storageUri.startsWith('file://')).toBe(true);
    expect(out.storageUri.endsWith('abc-123.gz')).toBe(true);
    const stats = await fs.stat(joinPath(TEST_ROOT, 'abc-123.gz'));
    expect(stats.size).toBe(4);
  });

  it('download reads the bytes back via either chunkId OR storageUri', async () => {
    const store = createLocalFileStorage({ rootDir: TEST_ROOT });
    const bytes = new Uint8Array([5, 6, 7, 8]);
    const out = await store.upload({ chunkId: 'def-456', gzipBytes: bytes });
    const read1 = await store.download('def-456');
    const read2 = await store.download(out.storageUri);
    expect(Array.from(read1)).toEqual([5, 6, 7, 8]);
    expect(Array.from(read2)).toEqual([5, 6, 7, 8]);
  });

  it('refuses unsafe chunkIds (path traversal)', async () => {
    const store = createLocalFileStorage({ rootDir: TEST_ROOT });
    await expect(
      store.upload({
        chunkId: '../../etc/passwd',
        gzipBytes: new Uint8Array([0]),
      }),
    ).rejects.toThrow(/unsafe/);
  });

  it('download throws when the file does not exist', async () => {
    const store = createLocalFileStorage({ rootDir: TEST_ROOT });
    await expect(store.download('never-uploaded-id')).rejects.toThrow();
  });

  it('reports kind=local', async () => {
    const store = createLocalFileStorage({ rootDir: TEST_ROOT });
    expect(store.kind).toBe('local');
  });
});

describe('createS3Storage', () => {
  it('throws when @aws-sdk/client-s3 is not installed', async () => {
    await expect(
      createS3Storage({ bucket: 'b', region: 'us-east-1' }),
    ).rejects.toThrow();
  });
});

describe('selectSessionReplayStorage', () => {
  it('returns local FS when no AWS env is set', async () => {
    const store = await selectSessionReplayStorage({
      SESSION_REPLAY_LOCAL_DIR: TEST_ROOT,
    });
    expect(store.kind).toBe('local');
  });

  it('falls back to local FS when AWS env is set but SDK is missing', async () => {
    const store = await selectSessionReplayStorage({
      AWS_REGION: 'us-east-1',
      S3_SESSION_REPLAY_BUCKET: 'no-such-bucket',
      SESSION_REPLAY_LOCAL_DIR: TEST_ROOT,
    });
    expect(store.kind).toBe('local');
  });
});
