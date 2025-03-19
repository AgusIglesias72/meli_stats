import { createClient } from '@supabase/supabase-js';

// Estas variables deben estar definidas en tu archivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente para usar en componentes del lado del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente para usar en API routes del lado del servidor
export const createServerSupabaseClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, supabaseServiceKey);
};