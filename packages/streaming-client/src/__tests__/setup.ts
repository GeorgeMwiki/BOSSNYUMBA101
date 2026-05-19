/**
 * Phase J8 — vitest setup.
 *
 * Brings `fake-indexeddb` into the jsdom global so the
 * `IndexedDbOfflineCache` tests can run without a real browser. The
 * shim implements enough of the IndexedDB spec for `idb-keyval`'s
 * usage (object stores, get/set/delete, key iteration).
 */

import 'fake-indexeddb/auto';
