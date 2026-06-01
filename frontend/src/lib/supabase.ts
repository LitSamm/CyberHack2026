import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // During static prerender env vars may not be inlined yet — return a no-op proxy
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
