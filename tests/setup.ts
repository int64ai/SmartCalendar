/** Test setup: fake-indexeddb + chrome API mocking */
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '../src/data/database';

// Reset IndexedDB before each test
beforeEach(async () => {
  await db.events.clear();
  await db.undoLogs.clear();
});

// Minimal chrome API mock for tests that import chrome-dependent code
const chromeStorageData: Record<string, unknown> = {};

if (typeof globalThis.chrome === 'undefined') {
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: (keys: unknown, cb: (data: Record<string, unknown>) => void) => {
          const defaults = typeof keys === 'object' && keys !== null ? keys : {};
          cb({ ...(defaults as Record<string, unknown>), ...chromeStorageData });
        },
        set: (data: Record<string, unknown>, cb?: () => void) => {
          Object.assign(chromeStorageData, data);
          cb?.();
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
    },
    runtime: {
      sendMessage: () => Promise.resolve(),
      onMessage: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    sidePanel: {
      setPanelBehavior: () => {},
    },
  };
}
