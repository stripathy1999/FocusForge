import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Enable if we have URL and at least one key (anon or service)
export const supabaseEnabled = Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));

export const supabase = supabaseEnabled && supabaseAnonKey
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

// For admin operations (bypasses RLS) - prefer service role key, fallback to anon key
export const supabaseAdmin = supabaseEnabled && supabaseUrl
  ? createClient(
      supabaseUrl as string,
      supabaseServiceKey || supabaseAnonKey || '',
      {
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
      }
    )
  : null;
