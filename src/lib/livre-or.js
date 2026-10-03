import { getSupabaseClient } from './supabase.js';

export const GUESTBOOK_MESSAGE_MAX = 1500;
export const GUESTBOOK_SIGNATURE_MAX = 120;

export async function getGuestbookEntry(token) {
  const { data, error } = await getSupabaseClient().rpc('get_guestbook_entry', {
    p_token: token,
  });
  if (error) throw error;
  return data;
}

export async function submitGuestbookEntry(token, signature, message) {
  const { data, error } = await getSupabaseClient().rpc('submit_guestbook_entry', {
    p_token: token,
    p_signature: signature,
    p_message: message,
  });
  if (error) throw error;
  return data;
}

export async function listGuestbook() {
  const { data, error } = await getSupabaseClient().rpc('staff_list_guestbook');
  if (error) throw error;
  return data ?? [];
}

export async function deleteGuestbookEntry(inviteId) {
  const { data, error } = await getSupabaseClient().rpc(
    'admin_delete_guestbook_entry',
    { p_invite_id: inviteId },
  );
  if (error) throw error;
  return data;
}
