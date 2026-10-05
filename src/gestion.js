import './gestion.css';
import {
  createAdminInvite,
  deleteAdminInvite,
  loadAdminInvites,
  updateAdminInvite,
} from './lib/invitations-admin.js';
import {
  getCurrentSession,
  getStaffRole,
  signInStaff,
  signOutStaff,
} from './lib/staff.js';
import {
  changeTeamRole,
  createTeamMember,
  loadTeam,
  removeTeamMember,
  resetTeamPassword,
} from './lib/team-admin.js';
import { getSupabaseClient, supabaseConfigError } from './lib/supabase.js';
import { initSouvenirsAdmin } from './souvenirs-admin.js';

const root = document.querySelector('#admin-app');
root.innerHTML = `
  <header class="admin-header">
    <nav class="header-links" aria-label="Pages de l’équipe">
      <a class="back-link" href="/accueil.html">← Accueil équipe</a>
      <a class="back-link" href="/livre-or.html">Livre d’or</a>
    </nav>
    <div class="admin-heading">
      <p class="eyebrow">Noces de vermeil · Administration</p>
      <h1>Gestion des invitations</h1>
    </div>
    <button class="signout-button" type="button" id="sign-out" hidden>Déconnexion</button>
  </header>
  <main>
    <section class="admin-login" id="login-panel">
      <h2>Connexion administrateur</h2>
      <p>Cette page est réservée aux comptes dont le rôle est admin.</p>
      <form id="login-form">
        <label for="email">Courriel</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Mot de passe</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="primary-button" id="login-submit" type="submit">Se connecter</button>
      </form>
      <p class="notice" id="login-notice" role="alert" aria-live="assertive"></p>
    </section>
    <section class="admin-content" id="admin-content" hidden>
      <nav class="admin-tabs" role="tablist" aria-label="Administration">
        <button class="admin-tab" id="tab-invitations" type="button" role="tab" aria-selected="true" aria-controls="invitations-panel" data-admin-tab="invitations">Invitations</button>
        <button class="admin-tab" id="tab-team" type="button" role="tab" aria-selected="false" aria-controls="team-panel" data-admin-tab="team" tabindex="-1">Équipe</button>
        <button class="admin-tab" id="tab-photos" type="button" role="tab" aria-selected="false" aria-controls="photos-panel" data-admin-tab="photos" tabindex="-1">Photos</button>
      </nav>
      <div class="admin-tab-panel" id="invitations-panel" role="tabpanel" aria-labelledby="tab-invitations">
        <section class="create-panel">
          <div>
            <p class="eyebrow">Nouvelle entrée</p>
            <h2>Créer une invitation</h2>
          </div>
          <form id="create-form" class="create-form">
            <label>Nom du foyer<input name="name" maxlength="120" required placeholder="Ex. Famille LeBlanc"></label>
            <label>Places<input name="places" type="number" min="1" max="30" value="2" required></label>
            <label>Table (facultative)<input name="table" type="number" min="1" placeholder="—"></label>
            <button class="primary-button" type="submit" id="create-submit">Créer l’invitation</button>
          </form>
          <p class="notice" id="create-notice" role="status" aria-live="polite"></p>
        </section>
        <section class="invite-list-panel">
          <div class="list-heading">
            <div>
              <p class="eyebrow">Administration</p>
              <h2>Toutes les invitations <span id="invite-total">0</span></h2>
            </div>
            <button class="secondary-button" type="button" id="export-csv">Exporter les liens CSV</button>
          </div>
          <label class="search-label" for="invite-search">Rechercher par nom</label>
          <input id="invite-search" class="invite-search" type="search" autocomplete="off" placeholder="Nom du foyer…">
          <div class="refresh-status" id="refresh-status" aria-live="polite"></div>
          <ul class="invite-list" id="invite-list"></ul>
        </section>
      </div>
      <section class="admin-tab-panel team-panel" id="team-panel" role="tabpanel" aria-labelledby="tab-team" hidden>
        <section class="create-panel">
          <div>
            <p class="eyebrow">Accès au site d’accueil</p>
            <h2>Ajouter un membre</h2>
          </div>
          <form id="team-create-form" class="team-create-form">
            <label>Courriel<input name="email" type="email" autocomplete="off" maxlength="254" required></label>
            <label>Mot de passe temporaire
              <span class="password-control">
                <input name="password" type="text" autocomplete="new-password" minlength="10" maxlength="128" required>
                <button class="secondary-button" type="button" data-generate-password>Générer</button>
              </span>
            </label>
            <label>Rôle
              <select name="role" required>
                <option value="accueil">Accueil</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button class="primary-button" type="submit" id="team-create-submit">Créer le compte</button>
          </form>
          <p class="team-help">Le compte sera confirmé immédiatement. Le mot de passe temporaire ne sera pas envoyé par courriel : transmettez-le au membre par un canal sûr.</p>
          <p class="notice" id="team-create-notice" role="status" aria-live="polite"></p>
        </section>
        <section class="invite-list-panel team-list-panel">
          <div class="list-heading">
            <div>
              <p class="eyebrow">Comptes autorisés</p>
              <h2>Utilisateurs Auth <span id="team-total">0</span></h2>
            </div>
            <button class="secondary-button" type="button" id="refresh-team">Actualiser</button>
          </div>
          <label class="search-label" for="team-search">Rechercher un utilisateur</label>
          <input id="team-search" class="invite-search" type="search" autocomplete="off" placeholder="Courriel…">
          <div class="refresh-status team-status" id="team-status" aria-live="polite"></div>
          <ul class="team-list" id="team-list"></ul>
        </section>
      </section>
      <section class="admin-tab-panel" id="photos-panel" role="tabpanel" aria-labelledby="tab-photos" hidden></section>
    </section>
  </main>
  <footer>Les liens d’invitation contiennent un code privé : partagez-les uniquement aux destinataires concernés. Les mots de passe temporaires doivent être transmis par un canal sûr.</footer>
`;

const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginSubmit = document.querySelector('#login-submit');
const loginNotice = document.querySelector('#login-notice');
const adminContent = document.querySelector('#admin-content');
const signOutButton = document.querySelector('#sign-out');
const createForm = document.querySelector('#create-form');
const createSubmit = document.querySelector('#create-submit');
const createNotice = document.querySelector('#create-notice');
const inviteSearch = document.querySelector('#invite-search');
const inviteList = document.querySelector('#invite-list');
const inviteTotal = document.querySelector('#invite-total');
const refreshStatus = document.querySelector('#refresh-status');
const exportButton = document.querySelector('#export-csv');
const adminTabs = Array.from(document.querySelectorAll('[data-admin-tab]'));
const invitationsPanel = document.querySelector('#invitations-panel');
const teamPanel = document.querySelector('#team-panel');
const photosPanel = document.querySelector('#photos-panel');
const souvenirsAdmin = initSouvenirsAdmin(photosPanel);
const teamCreateForm = document.querySelector('#team-create-form');
const teamCreateSubmit = document.querySelector('#team-create-submit');
const teamCreateNotice = document.querySelector('#team-create-notice');
const teamTotal = document.querySelector('#team-total');
const teamStatus = document.querySelector('#team-status');
const teamList = document.querySelector('#team-list');
const refreshTeamButton = document.querySelector('#refresh-team');
const teamSearch = document.querySelector('#team-search');

let invites = [];
let team = [];
let refreshTimer = 0;
let authSubscription = null;
let isAdmin = false;
let currentAdminId = null;

function setNotice(element, message, kind = '') {
  element.textContent = message;
  element.className = `notice${kind ? ` ${kind}` : ''}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function invitationUrl(invite) {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('i', invite.token);
  return url.href;
}

function responseLabel(presence) {
  if (presence === 'oui') return 'Présence confirmée';
  if (presence === 'non') return 'Absence';
  return 'Sans réponse';
}

function renderInvites() {
  inviteTotal.textContent = String(invites.length);
  const query = inviteSearch.value
    .trim()
    .toLocaleLowerCase('fr-CA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const filtered = invites.filter((invite) =>
    invite.nom_foyer
      .toLocaleLowerCase('fr-CA')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(query),
  );

  inviteList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = query
      ? 'Aucune invitation ne correspond à cette recherche.'
      : 'Aucune invitation. Créez la première ci-dessus.';
    inviteList.append(empty);
    return;
  }

  filtered.forEach((invite) => {
    const item = document.createElement('li');
    item.className = 'invite-card';
    item.dataset.inviteId = invite.id;
    item.innerHTML = `
      <div class="invite-card-heading">
        <div>
          <h3>${escapeHtml(invite.nom_foyer)}</h3>
          <span class="response-status">${escapeHtml(responseLabel(invite.presence))}</span>
        </div>
        <button class="delete-button" type="button" data-delete>Supprimer</button>
      </div>
      <div class="invite-link-block">
        <label>Lien personnel</label>
        <output data-link>${escapeHtml(invitationUrl(invite))}</output>
        <div class="link-actions">
          <button class="secondary-button" type="button" data-copy>Copier le lien</button>
          <button class="secondary-button" type="button" data-share>Partager</button>
        </div>
      </div>
      <form class="edit-form" data-edit-form>
        <label>Nom du foyer<input name="name" maxlength="120" value="${escapeHtml(invite.nom_foyer)}" required></label>
        <label>Places<input name="places" type="number" min="1" max="30" value="${escapeHtml(invite.places_max)}" required></label>
        <label>Table<input name="table" type="number" min="1" value="${invite.table_num == null ? '' : escapeHtml(invite.table_num)}" placeholder="Non attribuée"></label>
        <button class="save-button" type="submit" data-save>Enregistrer les modifications</button>
      </form>
      <p class="card-notice" data-card-notice role="status" aria-live="polite"></p>
    `;
    inviteList.append(item);
  });
}

async function refreshInvites() {
  const data = await loadAdminInvites();
  if (!Array.isArray(data)) throw new Error('La liste reçue de Supabase est invalide.');
  invites = data;
  renderInvites();
  refreshStatus.textContent = `Actualisé à ${new Intl.DateTimeFormat('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())}`;
}

function generateTemporaryPassword() {
  const groups = [
    'abcdefghijkmnopqrstuvwxyz',
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    '23456789',
    '!@#$%*-_?',
  ];
  const allCharacters = groups.join('');
  const passwordCharacters = groups.map((group) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return group[values[0] % group.length];
  });
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  for (const value of values) {
    passwordCharacters.push(allCharacters[value % allCharacters.length]);
  }
  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const valuesToShuffle = new Uint32Array(1);
    crypto.getRandomValues(valuesToShuffle);
    const swapIndex = valuesToShuffle[0] % (index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index],
    ];
  }
  return passwordCharacters.join('');
}

function formatTeamCreated(date) {
  const createdAt = new Date(date);
  if (Number.isNaN(createdAt.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(createdAt);
}

function renderTeam() {
  teamTotal.textContent = String(team.length);
  teamList.replaceChildren();

  const query = teamSearch.value.trim().toLocaleLowerCase('fr-CA');
  const filteredTeam = team.filter((member) =>
    member.email.toLocaleLowerCase('fr-CA').includes(query),
  );

  if (!filteredTeam.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = query
      ? 'Aucun utilisateur ne correspond à cette recherche.'
      : 'Aucun compte utilisateur Auth.';
    teamList.append(empty);
    return;
  }

  filteredTeam.forEach((member) => {
    const item = document.createElement('li');
    item.className = 'team-card';
    item.dataset.memberId = member.id;
    const isSelfAdmin = member.id === currentAdminId && member.role === 'admin';
    const roleLabel =
      member.role === 'admin'
        ? 'Admin'
        : member.role === 'accueil'
          ? 'Accueil'
          : 'Aucun accès équipe';
    item.innerHTML = `
      <div class="team-card-heading">
        <div>
          <h3>${escapeHtml(member.email || 'Courriel indisponible')}</h3>
          <p>Compte créé le ${escapeHtml(formatTeamCreated(member.created_at))}</p>
        </div>
        <span class="team-role${member.role ? '' : ' no-team-role'}">${roleLabel}</span>
      </div>
      <form class="member-role-form" data-role-form>
        <label>Rôle
          <select name="role" required ${isSelfAdmin ? 'disabled' : ''}>
            ${member.role ? '' : '<option value="" selected disabled>Choisir un rôle</option>'}
            <option value="accueil" ${member.role === 'accueil' ? 'selected' : ''}>Accueil</option>
            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </label>
        <button class="secondary-button" type="submit" ${isSelfAdmin ? 'disabled' : ''}>${member.role ? 'Modifier le rôle' : 'Ajouter à l’équipe'}</button>
      </form>
      <form class="member-password-form" data-password-form>
        <label>Nouveau mot de passe temporaire
          <span class="password-control">
            <input name="password" type="text" autocomplete="new-password" minlength="10" maxlength="128" required>
            <button class="secondary-button" type="button" data-generate-password>Générer</button>
          </span>
        </label>
        <button class="secondary-button" type="submit">Réinitialiser le mot de passe</button>
      </form>
      <div class="member-remove-actions">
        <button class="delete-button" type="button" data-remove-access ${!member.role || isSelfAdmin ? 'disabled' : ''}>Retirer de l’équipe</button>
        <button class="delete-button" type="button" data-delete-account ${isSelfAdmin ? 'disabled' : ''}>${member.role ? 'Retirer et supprimer le compte' : 'Supprimer le compte Auth'}</button>
      </div>
      ${!member.role ? '<p class="team-help">Compte Auth existant, mais non inscrit dans la table staff. Choisissez un rôle pour lui donner accès à l’équipe.</p>' : ''}
      ${isSelfAdmin ? '<p class="team-help">Vous ne pouvez pas retirer votre propre rôle admin.</p>' : ''}
      <p class="card-notice" data-member-notice role="status" aria-live="polite"></p>
    `;
    teamList.append(item);
  });
}

async function refreshTeam() {
  teamStatus.classList.remove('error');
  teamStatus.textContent = 'Actualisation de l’équipe…';
  try {
    const data = await loadTeam();
    if (!Array.isArray(data)) throw new Error('La liste reçue du serveur est invalide.');
    team = data;
    renderTeam();
    teamStatus.textContent = `Actualisé à ${new Intl.DateTimeFormat('fr-CA', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())}`;
  } catch (error) {
    console.error('Impossible d’actualiser les membres de l’équipe.', error);
    teamStatus.textContent = error.message || 'Actualisation impossible. Vérifiez le réseau.';
    teamStatus.classList.add('error');
  }
}

function selectAdminTab(tabName) {
  const isTeamTab = tabName === 'team';
  invitationsPanel.hidden = tabName !== 'invitations';
  teamPanel.hidden = !isTeamTab;
  photosPanel.hidden = tabName !== 'photos';
  adminTabs.forEach((tab) => {
    const selected = tab.dataset.adminTab === tabName;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  if (isTeamTab && isAdmin) refreshTeam();
  if (tabName === 'photos' && isAdmin) souvenirsAdmin.refresh();
}

async function copyLink(invite, notice) {
  try {
    await navigator.clipboard.writeText(invitationUrl(invite));
    notice.textContent = 'Lien copié.';
    notice.className = 'card-notice success';
  } catch (error) {
    console.error('Impossible de copier le lien dans le presse-papiers.', error);
    notice.textContent = 'Copie impossible sur cet appareil. Sélectionnez le lien ci-dessus.';
    notice.className = 'card-notice error';
  }
}

async function shareInvite(invite, notice) {
  const url = invitationUrl(invite);
  if (!navigator.share) {
    await copyLink(invite, notice);
    if (notice.classList.contains('success')) {
      notice.textContent = 'Partage indisponible ici : lien copié.';
    }
    return;
  }

  try {
    await navigator.share({
      title: 'Votre invitation – Noces de vermeil',
      text: `Bonjour ${invite.nom_foyer}, voici votre invitation :`,
      url,
    });
    notice.textContent = 'Partage ouvert.';
    notice.className = 'card-notice success';
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('Impossible de partager le lien.', error);
    notice.textContent = 'Le partage a échoué. Vous pouvez copier le lien.';
    notice.className = 'card-notice error';
  }
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [
    ['Nom du foyer', 'Places', 'Table', 'Statut RSVP', 'Lien'],
    ...invites.map((invite) => [
      invite.nom_foyer,
      invite.places_max,
      invite.table_num ?? '',
      responseLabel(invite.presence),
      invitationUrl(invite),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'invitations-noces-de-vermeil.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showAdmin(session) {
  if (!session?.user) {
    isAdmin = false;
    currentAdminId = null;
    loginPanel.hidden = false;
    adminContent.hidden = true;
    signOutButton.hidden = true;
    return;
  }

  loginPanel.hidden = true;
  try {
    const role = await getStaffRole(session.user.id);
    if (role !== 'admin') {
      await signOutStaff();
      loginPanel.hidden = false;
      adminContent.hidden = true;
      signOutButton.hidden = true;
      currentAdminId = null;
      setNotice(
        loginNotice,
        role
          ? 'Votre compte est limité au rôle accueil. Cette page est réservée aux administrateurs.'
          : 'Ce compte ne figure pas dans l’équipe. Demandez aux hôtes de vérifier votre accès.',
        'error',
      );
      return;
    }

    isAdmin = true;
    currentAdminId = session.user.id;
    adminContent.hidden = false;
    signOutButton.hidden = false;
    renderTeam();
    setNotice(loginNotice, '');
    await refreshInvites();
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      refreshInvites().catch((error) => {
        console.error('Impossible d’actualiser les invitations.', error);
        refreshStatus.textContent = 'Actualisation impossible. Vérifiez le réseau.';
      });
      if (!teamPanel.hidden) refreshTeam();
    }, 15_000);
  } catch (error) {
    console.error('Impossible de vérifier le rôle administrateur.', error);
    isAdmin = false;
    currentAdminId = null;
    loginPanel.hidden = false;
    adminContent.hidden = true;
    setNotice(loginNotice, 'La vérification des droits a échoué. Réessayez.', 'error');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginSubmit.disabled = true;
  setNotice(loginNotice, 'Connexion en cours…');
  try {
    const formData = new FormData(loginForm);
    const session = await signInStaff(
      String(formData.get('email')).trim(),
      String(formData.get('password')),
    );
    await showAdmin(session);
  } catch (error) {
    console.error('Échec de connexion administrateur.', error);
    setNotice(loginNotice, 'Connexion impossible. Vérifiez le courriel et le mot de passe.', 'error');
  } finally {
    loginSubmit.disabled = false;
  }
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  createSubmit.disabled = true;
  setNotice(createNotice, 'Création en cours…');
  const formData = new FormData(createForm);
  try {
    await createAdminInvite({
      name: String(formData.get('name')).trim(),
      places: Number(formData.get('places')),
      table: formData.get('table') ? Number(formData.get('table')) : null,
    });
    createForm.reset();
    createForm.elements.places.value = '2';
    setNotice(createNotice, 'Invitation créée.', 'success');
    await refreshInvites();
  } catch (error) {
    console.error('Impossible de créer cette invitation.', error);
    setNotice(createNotice, 'Création impossible. Vérifiez les champs et réessayez.', 'error');
  } finally {
    createSubmit.disabled = false;
  }
});

adminTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    selectAdminTab(tab.dataset.adminTab);
  });
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? adminTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + adminTabs.length) %
            adminTabs.length;
    adminTabs[nextIndex].click();
    adminTabs[nextIndex].focus();
  });
});

teamCreateForm.addEventListener('click', (event) => {
  if (!event.target.closest('[data-generate-password]')) return;
  teamCreateForm.elements.password.value = generateTemporaryPassword();
});

teamSearch.addEventListener('input', renderTeam);

teamCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  teamCreateSubmit.disabled = true;
  setNotice(teamCreateNotice, 'Création du compte…');
  const formData = new FormData(teamCreateForm);
  const temporaryPassword = String(formData.get('password'));
  try {
    await createTeamMember({
      email: String(formData.get('email')).trim(),
      password: temporaryPassword,
      role: String(formData.get('role')),
    });
    teamCreateForm.reset();
    await refreshTeam();
    setNotice(
      teamCreateNotice,
      `Compte créé et confirmé. Mot de passe temporaire : ${temporaryPassword}`,
      'success',
    );
  } catch (error) {
    console.error('Impossible de créer ce membre.', error);
    setNotice(
      teamCreateNotice,
      error.message || 'Création impossible. Vérifiez les champs et réessayez.',
      'error',
    );
  } finally {
    teamCreateSubmit.disabled = false;
  }
});

teamList.addEventListener('click', async (event) => {
  const generateButton = event.target.closest('[data-generate-password]');
  if (generateButton) {
    generateButton
      .closest('.password-control')
      .querySelector('input[name="password"]').value = generateTemporaryPassword();
    return;
  }

  const card = event.target.closest('[data-member-id]');
  if (!card || !isAdmin) return;
  const member = team.find((item) => item.id === card.dataset.memberId);
  if (!member) return;
  const deleteAccount = event.target.closest('[data-delete-account]');
  const removeAccess = event.target.closest('[data-remove-access]');
  if (!deleteAccount && !removeAccess) return;
  if (member.id === currentAdminId && member.role === 'admin') return;

  const confirmed = window.confirm(
    deleteAccount
      ? `Supprimer définitivement le compte Auth de ${member.email}${member.role ? ' et retirer son accès à l’équipe' : ''} ? Cette action est irréversible.`
      : `Retirer ${member.email} de l’équipe ? Son compte Auth restera présent, mais il ne pourra plus accéder aux fonctions d’accueil.`,
  );
  if (!confirmed) return;

  const actionButtons = Array.from(card.querySelectorAll('button'));
  actionButtons.forEach((button) => {
    button.disabled = true;
  });
  try {
    const result = await removeTeamMember(member.id, Boolean(deleteAccount));
    await refreshTeam();
    teamStatus.textContent = result.warning
      || (deleteAccount ? 'Membre et compte Auth supprimés.' : 'Accès à l’équipe retiré.');
    if (result.warning) teamStatus.classList.add('error');
  } catch (error) {
    console.error('Impossible de retirer ce membre.', error);
    const notice = card.querySelector('[data-member-notice]');
    notice.textContent = error.message || 'Retrait impossible. Réessayez.';
    notice.className = 'card-notice error';
    actionButtons.forEach((button) => {
      button.disabled = false;
    });
  }
});

teamList.addEventListener('submit', async (event) => {
  const roleForm = event.target.closest('[data-role-form]');
  const passwordForm = event.target.closest('[data-password-form]');
  if (!roleForm && !passwordForm) return;
  event.preventDefault();
  if (!isAdmin) return;

  const form = roleForm || passwordForm;
  const card = form.closest('[data-member-id]');
  const member = team.find((item) => item.id === card.dataset.memberId);
  if (!member) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const password = String(formData.get('password') || '');
  submitButton.disabled = true;

  try {
    if (roleForm) {
      await changeTeamRole(member.id, String(formData.get('role')));
      await refreshTeam();
      teamStatus.textContent = member.role
        ? `Rôle de ${member.email} modifié.`
        : `${member.email} a été ajouté à l’équipe.`;
      return;
    }

    await resetTeamPassword(member.id, password);
    await refreshTeam();
    teamStatus.textContent =
      `Mot de passe réinitialisé pour ${member.email}. Mot de passe temporaire : ${password}`;
  } catch (error) {
    console.error('Impossible de modifier ce membre.', error);
    const notice = card.querySelector('[data-member-notice]');
    notice.textContent = error.message || 'Modification impossible. Réessayez.';
    notice.className = 'card-notice error';
    submitButton.disabled = false;
  }
});

refreshTeamButton.addEventListener('click', refreshTeam);

inviteSearch.addEventListener('input', renderInvites);
exportButton.addEventListener('click', exportCsv);

inviteList.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-invite-id]');
  if (!card || !isAdmin) return;
  const invite = invites.find((item) => item.id === card.dataset.inviteId);
  const notice = card.querySelector('[data-card-notice]');
  if (!invite) return;

  if (event.target.closest('[data-copy]')) {
    await copyLink(invite, notice);
  } else if (event.target.closest('[data-share]')) {
    await shareInvite(invite, notice);
  } else if (event.target.closest('[data-delete]')) {
    const confirmed = window.confirm(
      `Supprimer l’invitation de « ${invite.nom_foyer} » ? Cette action supprimera aussi sa réponse RSVP et ne peut pas être annulée.`,
    );
    if (!confirmed) return;
    try {
      await deleteAdminInvite(invite.id);
      invites = invites.filter((item) => item.id !== invite.id);
      renderInvites();
    } catch (error) {
      console.error('Impossible de supprimer cette invitation.', error);
      notice.textContent = 'Suppression impossible. Réessayez.';
      notice.className = 'card-notice error';
    }
  }
});

inviteList.addEventListener('submit', async (event) => {
  if (!event.target.matches('[data-edit-form]')) return;
  event.preventDefault();
  if (!isAdmin) return;

  const form = event.target;
  const card = form.closest('[data-invite-id]');
  const invite = invites.find((item) => item.id === card.dataset.inviteId);
  const submitButton = form.querySelector('[data-save]');
  const notice = card.querySelector('[data-card-notice]');
  const formData = new FormData(form);
  if (!invite) return;

  submitButton.disabled = true;
  try {
    await updateAdminInvite({
      id: invite.id,
      name: String(formData.get('name')).trim(),
      places: Number(formData.get('places')),
      table: formData.get('table') ? Number(formData.get('table')) : null,
    });
    await refreshInvites();
    const updatedCard = inviteList.querySelector(`[data-invite-id="${invite.id}"]`);
    const updatedNotice = updatedCard?.querySelector('[data-card-notice]');
    if (updatedNotice) {
      updatedNotice.textContent = 'Modifications enregistrées.';
      updatedNotice.className = 'card-notice success';
    }
  } catch (error) {
    console.error('Impossible de modifier cette invitation.', error);
    notice.textContent = 'Modification impossible. Vérifiez les champs et réessayez.';
    notice.className = 'card-notice error';
    submitButton.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  try {
    await signOutStaff();
    isAdmin = false;
    currentAdminId = null;
    team = [];
    window.clearInterval(refreshTimer);
    adminContent.hidden = true;
    loginPanel.hidden = false;
    signOutButton.hidden = true;
  } catch (error) {
    console.error('Impossible de fermer la session administrateur.', error);
    setNotice(loginNotice, 'Déconnexion impossible. Réessayez.', 'error');
  }
});

if (supabaseConfigError) {
  loginSubmit.disabled = true;
  setNotice(loginNotice, supabaseConfigError, 'error');
} else {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    if (!session) {
      isAdmin = false;
      currentAdminId = null;
      team = [];
      window.clearInterval(refreshTimer);
      adminContent.hidden = true;
      signOutButton.hidden = true;
      loginPanel.hidden = false;
    }
  });
  authSubscription = subscription;
  getCurrentSession()
    .then(showAdmin)
    .catch((error) => {
      console.error('Impossible de restaurer la session admin.', error);
      setNotice(loginNotice, 'Impossible de vérifier la session. Rechargez la page.', 'error');
    });
}

window.addEventListener(
  'pagehide',
  () => {
    window.clearInterval(refreshTimer);
    authSubscription?.unsubscribe();
  },
  { once: true },
);
