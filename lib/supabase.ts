import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export const supabaseAdmin = supabaseEnabled
  ? createClient(
      supabaseUrl as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY || (supabaseAnonKey as string),
    )
  : null;
