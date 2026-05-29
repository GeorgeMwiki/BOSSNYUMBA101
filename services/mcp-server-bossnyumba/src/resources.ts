/**
 * MCP resources surfaced to external clients.
 *
 * Resources are read-only side-data the agent can pull to enrich its
 * planning. Each resource resolves via the api-gateway HTTP layer.
 */

import type { BossNyumbaMcpResource } from './types.js';

const obj = <T>(v: T): T => Object.freeze(v) as T;

export const BOSSNYUMBA_PUBLIC_MCP_RESOURCES: ReadonlyArray<BossNyumbaMcpResource> =
  Object.freeze([
    obj({
      uri: 'bossnyumba://capabilities',
      name: 'BossNyumba capability manifest',
      description:
        'Public capability manifest at /.well-known/bossnyumba-capabilities.json. Lists every surface, every scope, every rate-limit.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://estate/entities',
      name: 'Estate entity index',
      description:
        'Compact entity-index summary for the owner s estate. Equivalent of an Aider repomap.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://decisions/recent',
      name: 'Recent decisions',
      description:
        'Last 50 decisions logged in the journal with their retrospection ratings.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://calibration/current',
      name: 'Current calibration posture',
      description:
        'Calibration monitor current state per persona — over- or under-confident per recent outcomes.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://corpus/property/index',
      name: 'Property corpus chunk index',
      description:
        'Index of the tenant-shared property corpus chunks (intelligence_corpus_chunks where tenant_id IS NULL).',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://compliance/posture',
      name: 'Compliance posture',
      description:
        'Current PCCB / PDPA / FAR posture for the owner s estate.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://memory/advisor',
      name: 'Advisor memory snapshot',
      description:
        'Long-term advisor memory snapshot for cross-session continuity.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://reminders/upcoming',
      name: 'Upcoming reminders',
      description:
        'Owner s upcoming reminders. Subscribable — server pushes notifications/resources/updated whenever a reminder is created / cancelled / fires.',
      mimeType: 'application/json',
    }),
    obj({
      uri: 'bossnyumba://workspace/state',
      name: 'Owner workspace state',
      description:
        'Snapshot of the owner s current cockpit state — open tabs, recent reminders, pinned items. Subscribable.',
      mimeType: 'application/json',
    }),
  ]);

export function findResource(uri: string): BossNyumbaMcpResource | undefined {
  return BOSSNYUMBA_PUBLIC_MCP_RESOURCES.find((r) => r.uri === uri);
}
