import { createClient } from '@supabase/supabase-js';

// --- DATABASE SETUP INSTRUCTIONS ---
// If your tables are missing or you see "database empty" errors:
// 1. Copy the content of the 'SUPABASE_SETUP.sql' file in your project root.
// 2. Go to Supabase Dashboard -> SQL Editor.
// 3. Paste the SQL and run it.
// 4. Go to Authentication -> Providers -> Email and disable "Confirm Email" for instant logins.

const supabaseUrl = process.env.SUPABASE_URL || 'https://gkloekpohsjsdzjftmil.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_R31EfM-VEQ8Cs-weo38hlg_BJQ2kF8x';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Auth will not work.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);