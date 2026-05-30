/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  establishSupabaseSession,
  restoreStoredAppSession,
} = require('./authSession');

test('establishSupabaseSession registers backend tokens with Supabase auth', async () => {
  let receivedSession = null;
  const supabase = {
    auth: {
      setSession: async (session) => {
        receivedSession = session;
        return { error: null };
      },
    },
  };

  await establishSupabaseSession(supabase, {
    access_token: 'backend-access-token',
    refresh_token: 'backend-refresh-token',
  });

  assert.deepEqual(receivedSession, {
    access_token: 'backend-access-token',
    refresh_token: 'backend-refresh-token',
  });
});

test('restoreStoredAppSession clears custom login state when Supabase session is missing', async () => {
  const values = new Map([
    ['aromos_token', 'stale-token'],
    ['aromos_user', JSON.stringify({ id: 'user-1' })],
  ]);
  const storage = {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  };

  const restored = await restoreStoredAppSession(supabase, storage);

  assert.equal(restored, null);
  assert.equal(values.has('aromos_token'), false);
  assert.equal(values.has('aromos_user'), false);
});
