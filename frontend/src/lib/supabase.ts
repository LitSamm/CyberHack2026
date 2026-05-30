import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    "https://wcopdglthdslvkcrvvzr.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjb3BkZ2x0aGRzbHZrY3J2dnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDY1NzMsImV4cCI6MjA5NTYyMjU3M30.kQsuBx_EHJWxbuSI8kv7CQSjzNMQU8CumUNo4DSxqWI"
  );
}
