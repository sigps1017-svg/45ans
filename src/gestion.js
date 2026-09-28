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
import { getSupabaseClient, supabaseConfigError } from './lib/supabase.js';

const root = document.querySelector('#admin-app');
root.innerHTML = `
  <header class="admin-header">
    <a class="back-link" href="/accueil.html">← Accueil équipe</a>
    <div class="admin-heading">
      <p class="eyebrow">Noces de saphir · Administration</p>
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
    </section>
  </main>
  <footer>Les liens d’invitation contiennent un code privé : partagez-les uniquement aux destinataires concernés.</footer>
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

let invites = [];
let refreshTimer = 0;
let authSubscription = null;
let isAdmin = false;

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
      title: 'Votre invitation – Noces de saphir',
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
  anchor.download = 'invitations-noces-de-saphir.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showAdmin(session) {
  if (!session?.user) {
    isAdmin = false;
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
    adminContent.hidden = false;
    signOutButton.hidden = false;
    setNotice(loginNotice, '');
    await refreshInvites();
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      refreshInvites().catch((error) => {
        console.error('Impossible d’actualiser les invitations.', error);
        refreshStatus.textContent = 'Actualisation impossible. Vérifiez le réseau.';
      });
    }, 15_000);
  } catch (error) {
    console.error('Impossible de vérifier le rôle administrateur.', error);
    isAdmin = false;
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
