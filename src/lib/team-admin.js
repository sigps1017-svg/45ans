import { getSupabaseClient } from './supabase.js';

async function callTeamApi(payload) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('La session administrateur a expiré.');

  const response = await fetch('/api/team', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'La requête de gestion de l’équipe a échoué.');
  }
  return result;
}

export function loadTeam() {
  return callTeamApi({ action: 'list' });
}

export function createTeamMember({ email, password, role }) {
  return callTeamApi({ action: 'create', email, password, role });
}

export function changeTeamRole(memberId, role) {
  return callTeamApi({ action: 'change-role', memberId, role });
}

export function resetTeamPassword(memberId, password) {
  return callTeamApi({ action: 'reset-password', memberId, password });
}

export function removeTeamMember(memberId, deleteAuth) {
  return callTeamApi({ action: 'remove', memberId, deleteAuth });
}
