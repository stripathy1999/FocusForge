import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Configure Supabase client with explicit headers to avoid 406 errors
const supabaseOptions = {
  db: {
    schema: 'public' // Explicitly use public schema only
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey
    }
  },
  auth: {
    persistSession: false // Don't persist sessions in backend
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions)

// For admin operations (bypasses RLS)
const supabaseAdminOptions = {
  ...supabaseOptions,
  global: {
    ...supabaseOptions.global,
    headers: {
      ...supabaseOptions.global.headers,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
    }
  }
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
  supabaseAdminOptions
)
