import { createClient } from '@supabase/supabase-js';

// SECURITY NOTE:
// The 'anon' key is safe to expose in the browser IF Row Level Security (RLS) is enabled on your database.
// However, to keep your GitHub repo clean, you should use Environment Variables.
// In a local setup (VS Code), create a .env file and add:
// VITE_SUPABASE_URL=your_url
// VITE_SUPABASE_ANON_KEY=your_key

const supabaseUrl = process.env.SUPABASE_URL || 'https://gkloekpohsjsdzjftmil.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_R31EfM-VEQ8Cs-weo38hlg_BJQ2kF8x';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Auth will not work.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);