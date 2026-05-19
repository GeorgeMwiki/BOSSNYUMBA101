/**
 * Streaming sink helpers.
 *
 * `createCollectorSink` — useful for tests + Storybook; captures events
 * in an array so assertions can read them back. The portal wires a
 * sink that publishes onto J8's streaming-client `BroadcastChannel`.
 */

import type { BlackboardInteractionEvent, BlackboardStreamSink } from '../types';

export interface CollectorSink extends BlackboardStreamSink {
  readonly events: ReadonlyArray<BlackboardInteractionEvent>;
  readonly drain: () => ReadonlyArray<BlackboardInteractionEvent>;
  readonly reset: () => void;
}

export function createCollectorSink(): CollectorSink {
  let buffer: BlackboardInteractionEvent[] = [];

  return {
    get events() {
      return buffer;
    },
    emit(event) {
      buffer = [...buffer, event];
    },
    drain() {
      const out = buffer;
      buffer = [];
      return out;
    },
    reset() {
      buffer = [];
    },
  };
}

/**
 * Convenience — fan an event out to multiple sinks (entity store +
 * streaming client, typically).
 */
export function fanOut(
  ...sinks: ReadonlyArray<BlackboardStreamSink>
): BlackboardStreamSink {
  return {
    async emit(event) {
      for (const sink of sinks) {
        await sink.emit(event);
      }
    },
  };
}
