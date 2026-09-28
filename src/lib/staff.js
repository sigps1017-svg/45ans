import { getSupabaseClient } from './supabase.js';

export async function getCurrentSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInStaff(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOutStaff() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function isStaffMember(userId) {
  const { data, error } = await getSupabaseClient()
    .from('staff')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function loadStaffData() {
  const client = getSupabaseClient();
  const [inviteResult, responseResult] = await Promise.all([
    client
      .from('invites')
      .select('id, token, nom_foyer, places_max, table_num')
      .order('nom_foyer'),
    client
      .from('reponses')
      .select(
        'invite_id, presence, invites_detail, allergies, updated_at, checked_in_at',
      ),
  ]);

  if (inviteResult.error) throw inviteResult.error;
  if (responseResult.error) throw responseResult.error;

  const responses = new Map(
    responseResult.data.map((response) => [response.invite_id, response]),
  );
  const invites = inviteResult.data.map((invite) => ({
    ...invite,
    response: responses.get(invite.id) ?? null,
  }));
  const attending = invites.filter((invite) => invite.response?.presence === 'oui');

  return {
    invites,
    expected: attending.reduce(
      (total, invite) => total + invite.response.invites_detail.length,
      0,
    ),
    arrived: attending.reduce(
      (total, invite) =>
        total +
        (invite.response.checked_in_at
          ? invite.response.invites_detail.length
          : 0),
      0,
    ),
  };
}

export async function getStaffInviteByToken(token) {
  const client = getSupabaseClient();
  const { data: invite, error: inviteError } = await client
    .from('invites')
    .select('id, token, nom_foyer, places_max, table_num')
    .eq('token', token)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return null;

  const { data: response, error: responseError } = await client
    .from('reponses')
    .select('invite_id, presence, invites_detail, allergies, updated_at, checked_in_at')
    .eq('invite_id', invite.id)
    .maybeSingle();
  if (responseError) throw responseError;

  return { ...invite, response };
}

export async function updateArrival(inviteId, checkedInAt) {
  const { data, error } = await getSupabaseClient()
    .from('reponses')
    .update({ checked_in_at: checkedInAt })
    .eq('invite_id', inviteId)
    .select('checked_in_at')
    .single();
  if (error) throw error;
  return data;
}
