import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
const supabaseKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
const configuredUrl = 'https://wkjnxohfggqwhemalelf.supabase.co';
const configuredAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indram54b2hmZ2dxd2hlbWFsZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTI4ODUsImV4cCI6MjA5NjI2ODg4NX0.-JCIYS5e2D7OkUr5AmWnr0SEN0vT3GhPp-CXvRLVvAE';

export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  Boolean(supabaseKey);

export const supabase = createClient(supabaseUrl || configuredUrl, supabaseKey || configuredAnonKey);

export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
