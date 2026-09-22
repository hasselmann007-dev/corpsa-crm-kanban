import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://yjjzmgrjgracgzqywaqc.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Jcb8tZ7M1nnDJQSjzMChjw_RqcuA2Tx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
