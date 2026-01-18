import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate URL format (must be a valid HTTP/HTTPS URL)
function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Enable if we have valid URL and at least one key (anon or service)
const hasValidUrl = isValidUrl(supabaseUrl);
export const supabaseEnabled = Boolean(hasValidUrl && (supabaseAnonKey || supabaseServiceKey));

export const supabase = supabaseEnabled && supabaseAnonKey && hasValidUrl
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

// For admin operations (bypasses RLS) - prefer service role key, fallback to anon key
export const supabaseAdmin = supabaseEnabled && hasValidUrl && (supabaseServiceKey || supabaseAnonKey)
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
