/**
 * Supabase client — web dashboard.
 *
 * Used exclusively for authentication (signIn, signOut, session management).
 * All data access still goes through the FastAPI backend via the `api` service.
 *
 * Env vars required (Vercel Environment Variables):
 *   VITE_SUPABASE_URL      — e.g. https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY — the anon/public key from Supabase → Settings → API
 *
 * If either var is missing the client is null and the Login page falls back
 * to the legacy email/password flow directly against the FastAPI backend.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // Keep Supabase session in localStorage so refresh tokens survive page reloads.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/** Returns true when Supabase is configured and should be used for auth. */
export const isSupabaseEnabled = (): boolean => supabase !== null;
