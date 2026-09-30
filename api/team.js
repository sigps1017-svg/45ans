import { createClient } from '@supabase/supabase-js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validRoles = new Set(['admin', 'accueil']);

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, body) {
  response.status(status);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.json(body);
}

function requireString(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new RequestError(400, `${label} invalide.`);
  }
  return value.trim();
}

function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    throw new RequestError(
      400,
      'Le mot de passe doit contenir entre 10 et 128 caractères.',
    );
  }
  return value;
}

function requireMemberId(value) {
  const memberId = requireString(value, 'Identifiant du membre');
  if (!uuidPattern.test(memberId)) {
    throw new RequestError(400, 'Identifiant du membre invalide.');
  }
  return memberId;
}

function requireRole(value) {
  if (!validRoles.has(value)) {
    throw new RequestError(400, 'Le rôle doit être admin ou accueil.');
  }
  return value;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new RequestError(
      500,
      'La configuration serveur Supabase est incomplète.',
    );
  }
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireAdmin(request, client) {
  const authorization = request.headers.authorization ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new RequestError(401, 'Connexion requise.');
  }

  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) {
    throw new RequestError(401, 'La session est invalide ou expirée.');
  }

  const { data: member, error: staffError } = await client
    .from('staff')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (member?.role !== 'admin') {
    throw new RequestError(403, 'Cette opération est réservée aux admins.');
  }
  return data.user;
}

async function listTeam(client) {
  const { data: staff, error: staffError } = await client
    .from('staff')
    .select('user_id, role, created_at')
    .order('created_at', { ascending: true });
  if (staffError) throw staffError;

  const users = [];
  const perPage = 100;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const staffById = new Map(staff.map((member) => [member.user_id, member]));
  return users.map((user) => {
    const member = staffById.get(user.id);
    return {
      id: user.id,
      email: user.email ?? '',
      role: member?.role ?? null,
      created_at: user.created_at,
    };
  });
}

async function createTeamMember(client, body) {
  const email = requireString(body.email, 'Courriel', 254).toLowerCase();
  if (!emailPattern.test(email)) {
    throw new RequestError(400, 'Adresse courriel invalide.');
  }
  const password = requirePassword(body.password);
  const role = requireRole(body.role);

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    if (['user_already_exists', 'email_exists'].includes(error.code)) {
      throw new RequestError(409, 'Un compte existe déjà pour ce courriel.');
    }
    throw new RequestError(
      400,
      'Création impossible. Vérifiez le courriel, le mot de passe et les règles Auth.',
    );
  }
  if (!data.user) {
    throw new RequestError(500, 'Supabase n’a pas retourné le compte créé.');
  }

  const { error: insertError } = await client.from('staff').insert({
    user_id: data.user.id,
    role,
  });
  if (insertError) {
    const { error: rollbackError } = await client.auth.admin.deleteUser(
      data.user.id,
    );
    if (rollbackError) {
      console.error('Could not roll back a partially created staff account.', {
        code: rollbackError.code,
      });
      throw new RequestError(
        500,
        'Le compte Auth a été créé, mais son ajout à l’équipe a échoué. Vérifiez ce compte dans Supabase Auth.',
      );
    }
    throw new RequestError(
      500,
      'Le membre n’a pas pu être ajouté à l’équipe; la création du compte a été annulée.',
    );
  }

  return {
    id: data.user.id,
    email: data.user.email ?? email,
    role,
    created_at: data.user.created_at,
  };
}

async function ensureStaffTarget(client, memberId) {
  const { data, error } = await client.auth.admin.getUserById(memberId);
  if (error) throw error;
  if (!data.user) throw new RequestError(404, 'Compte Auth introuvable.');
}

async function changeMemberRole(client, actorId, body) {
  const targetId = requireMemberId(body.memberId);
  const role = requireRole(body.role);
  const { data, error } = await client.rpc('manage_staff_member', {
    p_actor_user_id: actorId,
    p_target_user_id: targetId,
    p_action: 'set_role',
    p_new_role: role,
  });
  if (error) throw error;
  if (!data) throw new RequestError(404, 'Compte Auth introuvable.');
  return { ok: true };
}

async function resetMemberPassword(client, body) {
  const targetId = requireMemberId(body.memberId);
  const password = requirePassword(body.password);
  await ensureStaffTarget(client, targetId);
  const { error } = await client.auth.admin.updateUserById(targetId, {
    password,
  });
  if (error) {
    throw new RequestError(400, 'La réinitialisation du mot de passe a échoué.');
  }
  return { ok: true };
}

async function removeTeamMember(client, actorId, body) {
  const targetId = requireMemberId(body.memberId);
  if (typeof body.deleteAuth !== 'boolean') {
    throw new RequestError(400, 'Le choix de suppression du compte est invalide.');
  }
  if (targetId === actorId) {
    throw new RequestError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
  }

  const { data, error } = await client.rpc('manage_staff_member', {
    p_actor_user_id: actorId,
    p_target_user_id: targetId,
    p_action: 'remove',
    p_new_role: null,
  });
  if (error) throw error;
  if (!data && !body.deleteAuth) {
    throw new RequestError(404, 'Ce compte n’a pas d’accès à retirer.');
  }
  if (!data) await ensureStaffTarget(client, targetId);
  if (!body.deleteAuth) return { ok: true, authDeleted: false };

  const { error: deleteError } = await client.auth.admin.deleteUser(targetId);
  if (deleteError) {
    console.error('Staff access was removed but Auth deletion failed.', {
      code: deleteError.code,
    });
    return {
      ok: true,
      authDeleted: false,
      warning:
        'Accès équipe retiré, mais le compte Auth n’a pas pu être supprimé. Vérifiez-le dans Supabase Auth.',
    };
  }
  return { ok: true, authDeleted: true };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Méthode non autorisée.' });
  }
  if (!/^Bearer\s+\S+$/i.test(request.headers.authorization ?? '')) {
    return sendJson(response, 401, { error: 'Connexion requise.' });
  }

  let client;
  let actor;
  try {
    client = getSupabaseAdmin();
    actor = await requireAdmin(request, client);
  } catch (error) {
    if (error instanceof RequestError) {
      return sendJson(response, error.status, { error: error.message });
    }
    console.error('Could not authenticate staff API request.', {
      code: error.code,
    });
    return sendJson(response, 500, {
      error: 'La vérification de l’accès a échoué.',
    });
  }

  try {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new RequestError(400, 'Corps de requête invalide.');
    }

    let result;
    switch (body.action) {
      case 'list':
        result = await listTeam(client);
        break;
      case 'create':
        result = await createTeamMember(client, body);
        break;
      case 'change-role':
        result = await changeMemberRole(client, actor.id, body);
        break;
      case 'reset-password':
        result = await resetMemberPassword(client, body);
        break;
      case 'remove':
        result = await removeTeamMember(client, actor.id, body);
        break;
      default:
        throw new RequestError(400, 'Action inconnue.');
    }
    return sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof RequestError) {
      return sendJson(response, error.status, { error: error.message });
    }
    if (error.code === '42501') {
      return sendJson(response, 403, {
        error: 'Cette opération est réservée aux admins.',
      });
    }
    if (error.code === 'P0002') {
      return sendJson(response, 404, {
        error: 'Membre introuvable dans l’équipe.',
      });
    }
    if (error.code === 'P0001') {
      const safetyMessages = {
        'You cannot remove your own admin role.':
          'Vous ne pouvez pas retirer votre propre rôle admin.',
        'You cannot remove your own admin access.':
          'Vous ne pouvez pas retirer votre propre accès admin.',
        'The last admin cannot be demoted.':
          'Impossible de rétrograder le dernier admin.',
        'The last admin cannot be removed.':
          'Impossible de retirer le dernier admin.',
      };
      return sendJson(response, 409, {
        error:
          safetyMessages[error.message] || 'Cette modification est interdite.',
      });
    }
    console.error('Staff API operation failed.', { code: error.code });
    return sendJson(response, 500, {
      error: 'L’opération a échoué. Réessayez ou vérifiez les journaux serveur.',
    });
  }
}
