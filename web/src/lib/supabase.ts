/**
 * Supabase client — web dashboard.
 *
 * Used exclusively for authentication (signIn, signOut, session management).
 * All data access still goes through the FastAPI backend via the `api` service.
 *
 * Required Vercel Environment Variables:
 *   VITE_SUPABASE_URL      — e.g. https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY — the anon/public key from Supabase → Settings → API
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables.\n" +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Environment Variables.",
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
