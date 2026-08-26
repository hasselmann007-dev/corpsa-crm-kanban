import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yjjzmgrjgracgzqywaqc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Jcb8tZ7M1nnDJQSjzMChjw_RqcuA2Tx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
