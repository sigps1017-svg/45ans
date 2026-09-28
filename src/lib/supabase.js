import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  supabaseUrl && supabaseAnonKey
    ? null
    : 'La connexion Supabase n’est pas configurée. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.';

const supabase =
  supabaseConfigError === null ? createClient(supabaseUrl, supabaseAnonKey) : null;

function requireClient() {
  if (!supabase) throw new Error(supabaseConfigError);
  return supabase;
}

export function getSupabaseClient() {
  return requireClient();
}

export async function getInvite(token) {
  const { data, error } = await requireClient().rpc('get_invite', {
    p_token: token,
  });
  if (error) throw error;
  return data;
}

export async function submitInviteRsvp(token, response) {
  const { data, error } = await requireClient().rpc('submit_rsvp', {
    p_token: token,
    p_presence: response.presence,
    p_invites_detail: response.guests,
    p_allergies: response.notes || null,
  });
  if (error) throw error;
  return data;
}
