/**
 * Tests for the requests/new intake upload flow (`uploadCaseEvidence`).
 *
 * The network call is injected, so these tests exercise the real
 * orchestration the page relies on — every blob-backed photo is
 * uploaded, failures are collected without aborting the rest, and
 * non-file previews are skipped — with the network fully mocked.
 */

import { describe, expect, it, vi } from 'vitest';
import { uploadCaseEvidence } from '../upload-case-evidence';

function photo(id: string, withFile = true) {
  return {
    id,
    file: withFile
      ? new File([new Uint8Array([1])], `${id}.jpg`, { type: 'image/jpeg' })
      : undefined,
  };
}

describe('uploadCaseEvidence', () => {
  it('uploads every blob-backed photo to the case and reports zero failures', async () => {
    const upload = vi.fn(async () => ({ id: 'ok' }));
    const result = await uploadCaseEvidence(
      'case-1',
      [photo('a'), photo('b')],
      upload,
    );

    expect(result.attempted).toBe(2);
    expect(result.failed).toHaveLength(0);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith('case-1', expect.any(File), {
      fileName: 'a.jpg',
    });
  });

  it('skips previews that have no File (already-remote)', async () => {
    const upload = vi.fn(async () => ({ id: 'ok' }));
    const result = await uploadCaseEvidence(
      'case-1',
      [photo('a'), photo('remote', false)],
      upload,
    );

    expect(result.attempted).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('returns no-op when there are no blob-backed photos', async () => {
    const upload = vi.fn(async () => ({ id: 'ok' }));
    const result = await uploadCaseEvidence(
      'case-1',
      [photo('remote', false)],
      upload,
    );

    expect(result).toEqual({ attempted: 0, failed: [] });
    expect(upload).not.toHaveBeenCalled();
  });

  it('collects the failures without aborting the successful uploads', async () => {
    // First photo succeeds, second rejects — both are still attempted.
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ id: 'ok' })
      .mockRejectedValueOnce(new Error('413 too large'));

    const result = await uploadCaseEvidence(
      'case-1',
      [photo('a'), photo('b')],
      upload,
    );

    expect(result.attempted).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe('b');
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('reports all photos as failed when every upload rejects', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await uploadCaseEvidence(
      'case-1',
      [photo('a'), photo('b')],
      upload,
    );

    expect(result.attempted).toBe(2);
    expect(result.failed.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
