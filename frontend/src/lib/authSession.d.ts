interface SupabaseSessionPayload {
  access_token: string;
  refresh_token: string;
}

interface SupabaseAuthClient {
  auth: {
    setSession(session: SupabaseSessionPayload): Promise<{ error: unknown | null }>;
    getSession(): Promise<{ data: { session: unknown | null } }>;
  };
}

interface StorageReader {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export function clearStoredAppSession(storage: StorageReader): void;

export function establishSupabaseSession(
  supabase: SupabaseAuthClient,
  session: SupabaseSessionPayload,
): Promise<void>;

export function restoreStoredAppSession<T = unknown>(
  supabase: SupabaseAuthClient,
  storage: StorageReader,
): Promise<{ token: string; user: T } | null>;
