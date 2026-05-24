/**
 * Realtime-rooms client (Owner Portal) — Central Command Phase B B6.
 *
 * See apps/admin-platform-portal/src/lib/realtime-rooms-client.ts for
 * the canonical commentary. Body is intentionally identical until a
 * portal-specific override is needed.
 */

import {
  configureLiveblocksFactory,
  configureYjsProvider,
  createLiveblocksRoom,
  type LiveblocksRoom,
  type CreateLiveblocksRoomOptions,
} from '@bossnyumba/realtime-rooms';

const AUTH_ENDPOINT = '/api/v1/realtime/auth';

let bootstrapped = false;
export async function bootstrapRealtimeRooms(): Promise<void> {
  if (bootstrapped) return;
  if (typeof window === 'undefined') return;

  try {
    const liveblocks: any = await import(
      /* webpackIgnore: true */ /* @vite-ignore */ '@liveblocks/client'
    );
    configureLiveblocksFactory(({ authEndpoint }) => {
      const client = liveblocks.createClient({
        authEndpoint: async (room: string) => {
          const res = await fetch(authEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              rooms: [{ id: room, access: 'FULL' }],
            }),
          });
          if (!res.ok) {
            throw new Error(
              `realtime-rooms: auth endpoint returned ${res.status}`,
            );
          }
          const json = await res.json();
          return json.data ?? json;
        },
      });
      return {
        enterRoom: (roomId: string, opts?: unknown) =>
          client.enter(roomId, opts as never),
        leave: (roomId: string) => client.leave(roomId),
      };
    });

    interface LiveblocksClientLike {
      readonly getRoom?: (roomId: string) => unknown;
    }
    interface LiveblocksYjsModule {
      readonly LiveblocksYjsProvider: new (
        room: unknown,
        ydoc: unknown,
      ) => {
        destroy(): void;
        on(event: 'sync', cb: (synced: boolean) => void): void;
        off(event: 'sync', cb: (synced: boolean) => void): void;
      };
    }
    const yjs = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ '@liveblocks/yjs'
    )) as unknown as LiveblocksYjsModule;
    configureYjsProvider(({ ydoc, client, roomId }) => {
      const room = (client as LiveblocksClientLike).getRoom?.(roomId);
      const provider = new yjs.LiveblocksYjsProvider(room, ydoc);
      return {
        destroy: () => provider.destroy(),
        on: (event: 'sync', cb: (synced: boolean) => void) =>
          provider.on(event, cb),
        off: (event: 'sync', cb: (synced: boolean) => void) =>
          provider.off(event, cb),
      };
    });

    bootstrapped = true;
  } catch {
    // SDK not yet installed — degrades gracefully.
  }
}

export interface UseRoomOptions
  extends Pick<CreateLiveblocksRoomOptions, 'userInfo'> {
  readonly roomId: string;
}

export function openRoom(opts: UseRoomOptions): LiveblocksRoom {
  return createLiveblocksRoom({
    roomId: opts.roomId,
    authEndpoint: AUTH_ENDPOINT,
    userInfo: opts.userInfo,
  });
}
