function clearStoredAppSession(storage) {
  storage.removeItem('aromos_token');
  storage.removeItem('aromos_user');
}

async function establishSupabaseSession(supabase, session) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error('Backend tidak mengembalikan sesi Supabase lengkap');
  }

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
}

async function restoreStoredAppSession(supabase, storage) {
  const savedToken = storage.getItem('aromos_token');
  const savedUser = storage.getItem('aromos_user');
  if (!savedToken || !savedUser) return null;

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    clearStoredAppSession(storage);
    return null;
  }

  try {
    return { token: savedToken, user: JSON.parse(savedUser) };
  } catch {
    clearStoredAppSession(storage);
    return null;
  }
}

module.exports = {
  clearStoredAppSession,
  establishSupabaseSession,
  restoreStoredAppSession,
};
