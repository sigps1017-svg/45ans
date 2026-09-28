import { getSupabaseClient } from './supabase.js';

async function callAdminRpc(functionName, args = {}) {
  const { data, error } = await getSupabaseClient().rpc(functionName, args);
  if (error) throw error;
  return data;
}

export function loadAdminInvites() {
  return callAdminRpc('admin_list_invites');
}

export function createAdminInvite({ name, places, table }) {
  return callAdminRpc('admin_create_invite', {
    p_nom_foyer: name,
    p_places_max: places,
    p_table_num: table,
  });
}

export function updateAdminInvite({ id, name, places, table }) {
  return callAdminRpc('admin_update_invite', {
    p_invite_id: id,
    p_nom_foyer: name,
    p_places_max: places,
    p_table_num: table,
  });
}

export function deleteAdminInvite(id) {
  return callAdminRpc('admin_delete_invite', { p_invite_id: id });
}
