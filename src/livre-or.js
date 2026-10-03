import './livre-or.css';
import { event } from './config.js';
import { deleteGuestbookEntry, listGuestbook } from './lib/livre-or.js';
import {
  getCurrentSession,
  getStaffRole,
  signInStaff,
  signOutStaff,
} from './lib/staff.js';
import { getSupabaseClient, supabaseConfigError } from './lib/supabase.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

const couple = event.hosts.join(' et ');
const writtenOn = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: event.timeZone,
});

// Bijou de la couverture, même dessin que sur la carte d'entrée.
const gemSvg = `
  <svg class="cover-gem" viewBox="-2 -2 124 106" aria-hidden="true">
    <defs>
      <linearGradient id="cover-gem-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.45" stop-color="#c4cad3" />
        <stop offset="1" stop-color="#7f8692" />
      </linearGradient>
    </defs>
    <polygon points="26.4,2.6 93.6,2.6 120,28.2 60,101 0,28.2" fill="url(#cover-gem-fill)" />
    <path d="M0 28.2H120M26.4 2.6L44.9 28.2L60 2.6L75.1 28.2L93.6 2.6M44.9 28.2L60 101L75.1 28.2"
      fill="none" stroke="#b0832f" stroke-width="2.4" stroke-linejoin="round" />
    <polygon points="36.5,5.6 53.3,5.6 41.5,25.2" fill="rgba(255,255,255,.55)" />
  </svg>
`;

const root = document.querySelector('#guestbook-app');
root.innerHTML = `
  <header class="guestbook-header no-print">
    <nav class="guestbook-links" aria-label="Pages de l’équipe">
      <a href="/accueil.html">← Accueil équipe</a>
      <a href="/gestion.html" id="admin-link" hidden>Gestion des invitations</a>
    </nav>
    <div class="guestbook-heading">
      <p class="eyebrow">Noces de vermeil · Équipe</p>
      <h1>Livre d’or</h1>
    </div>
    <button class="ghost-button" type="button" id="sign-out" hidden>Déconnexion</button>
  </header>
  <main>
    <section class="login-panel no-print" id="login-panel" aria-labelledby="login-title">
      <h2 id="login-title">Connexion de l’équipe</h2>
      <p>Le livre d’or est consultable par l’équipe d’accueil et les administrateurs.</p>
      <form id="login-form">
        <label for="email">Courriel</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Mot de passe</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="gold-button" type="submit" id="login-submit">Se connecter</button>
      </form>
      <p class="notice" id="login-notice" role="alert" aria-live="assertive"></p>
    </section>
    <section id="guestbook-panel" hidden>
      <div class="toolbar no-print">
        <p class="toolbar-count" id="entry-count" aria-live="polite"></p>
        <div class="toolbar-actions">
          <button class="ghost-button" type="button" id="refresh">Actualiser</button>
          <button class="gold-button" type="button" id="print">Imprimer le livre d’or</button>
        </div>
        <p class="notice" id="panel-notice" role="status" aria-live="polite"></p>
      </div>
      <article class="book" aria-label="Aperçu du livre d’or">
        <section class="book-cover">
          <div class="cover-frame">
            ${gemSvg}
            <p class="cover-kicker">Noces de vermeil</p>
            <h2 class="cover-title">Livre d’or</h2>
            <p class="cover-sub">${event.anniversaryYears} ans d’amour</p>
            <p class="cover-couple">${escapeHtml(couple)}</p>
            <div class="cover-rule" aria-hidden="true"></div>
            <p class="cover-date">${escapeHtml(event.dateLabel)}</p>
            <p class="cover-place">${escapeHtml(event.location)}</p>
          </div>
        </section>
        <section class="book-pages">
          <p class="pages-kicker">Les mots de leurs proches</p>
          <div class="book-entries" id="book-entries"></div>
        </section>
      </article>
    </section>
  </main>
`;

const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginNotice = document.querySelector('#login-notice');
const loginSubmit = document.querySelector('#login-submit');
const guestbookPanel = document.querySelector('#guestbook-panel');
const signOutButton = document.querySelector('#sign-out');
const adminLink = document.querySelector('#admin-link');
const entryCount = document.querySelector('#entry-count');
const entriesElement = document.querySelector('#book-entries');
const panelNotice = document.querySelector('#panel-notice');
const refreshButton = document.querySelector('#refresh');
const printButton = document.querySelector('#print');

let isAdmin = false;
let entries = [];
let pendingDeletion = null;

function setNotice(element, message, kind = '') {
  element.textContent = message;
  element.className = `notice${kind ? ` ${kind}` : ''}`;
}

function renderEntries() {
  entryCount.textContent = entries.length
    ? `${entries.length} message${entries.length > 1 ? 's' : ''} dans le livre d’or`
    : 'Aucun message pour le moment';
  printButton.disabled = entries.length === 0;

  if (!entries.length) {
    entriesElement.innerHTML =
      '<p class="book-empty">Les messages des invités apparaîtront ici dès qu’ils seront écrits.</p>';
    return;
  }

  entriesElement.innerHTML = entries
    .map((entry) => {
      const showFoyer =
        entry.nom_foyer.trim().toLocaleLowerCase('fr') !==
        entry.signature.trim().toLocaleLowerCase('fr');
      const confirming = pendingDeletion === entry.invite_id;
      return `
        <figure class="book-entry">
          <blockquote>${escapeHtml(entry.message)}</blockquote>
          <figcaption>
            <span class="entry-signature">${escapeHtml(entry.signature)}</span>
            <small>${showFoyer ? `${escapeHtml(entry.nom_foyer)} · ` : ''}${writtenOn.format(new Date(entry.created_at))}</small>
          </figcaption>
          ${
            isAdmin
              ? `<button class="delete-button no-print" type="button" data-delete="${entry.invite_id}">
                  ${confirming ? 'Confirmer la suppression' : 'Supprimer'}
                </button>`
              : ''
          }
        </figure>
      `;
    })
    .join('');
}

async function refreshEntries() {
  refreshButton.disabled = true;
  try {
    entries = await listGuestbook();
    pendingDeletion = null;
    renderEntries();
    setNotice(panelNotice, '');
  } catch (error) {
    console.error('Impossible de charger le livre d’or.', error);
    setNotice(panelNotice, 'Le livre d’or n’a pas pu être chargé. Vérifiez le réseau.', 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

function showLogin(message = '', kind = '') {
  loginPanel.hidden = false;
  guestbookPanel.hidden = true;
  signOutButton.hidden = true;
  adminLink.hidden = true;
  setNotice(loginNotice, message, kind);
}

async function authorizeSession(session) {
  if (!session?.user) {
    showLogin();
    return;
  }

  try {
    const role = await getStaffRole(session.user.id);
    if (!role) {
      await signOutStaff();
      showLogin(
        'Ce compte ne fait pas partie de l’équipe. Demandez aux hôtes de l’ajouter.',
        'error',
      );
      return;
    }

    isAdmin = role === 'admin';
    loginPanel.hidden = true;
    guestbookPanel.hidden = false;
    signOutButton.hidden = false;
    adminLink.hidden = !isAdmin;
    await refreshEntries();
  } catch (error) {
    console.error('Impossible de vérifier l’accès au livre d’or.', error);
    showLogin(
      'La vérification du compte a échoué. Vérifiez le réseau puis réessayez.',
      'error',
    );
  }
}

loginForm.addEventListener('submit', async (submitEvent) => {
  submitEvent.preventDefault();
  loginSubmit.disabled = true;
  setNotice(loginNotice, 'Connexion en cours…');
  try {
    const formData = new FormData(loginForm);
    const session = await signInStaff(
      String(formData.get('email')).trim(),
      String(formData.get('password')),
    );
    await authorizeSession(session);
  } catch (error) {
    console.error('Échec de connexion au livre d’or.', error);
    setNotice(loginNotice, 'Connexion impossible. Vérifiez le courriel et le mot de passe.', 'error');
  } finally {
    loginSubmit.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  try {
    await signOutStaff();
    showLogin();
  } catch (error) {
    console.error('Impossible de fermer la session.', error);
    setNotice(panelNotice, 'Déconnexion impossible. Réessayez.', 'error');
  }
});

refreshButton.addEventListener('click', refreshEntries);
printButton.addEventListener('click', () => window.print());

entriesElement.addEventListener('click', async (clickEvent) => {
  const button = clickEvent.target.closest('[data-delete]');
  if (!button) return;
  const inviteId = button.dataset.delete;

  // Premier clic : demande de confirmation ; second clic : suppression.
  if (pendingDeletion !== inviteId) {
    pendingDeletion = inviteId;
    renderEntries();
    return;
  }

  button.disabled = true;
  try {
    await deleteGuestbookEntry(inviteId);
    entries = entries.filter((entry) => entry.invite_id !== inviteId);
    pendingDeletion = null;
    renderEntries();
    setNotice(panelNotice, 'Message supprimé du livre d’or.', 'success');
  } catch (error) {
    console.error('Impossible de supprimer le message.', error);
    button.disabled = false;
    setNotice(panelNotice, 'La suppression a échoué. Réessayez.', 'error');
  }
});

if (supabaseConfigError) {
  loginSubmit.disabled = true;
  setNotice(loginNotice, supabaseConfigError, 'error');
} else {
  getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    if (!session) showLogin();
  });
  getCurrentSession()
    .then(authorizeSession)
    .catch((error) => {
      console.error('Impossible de restaurer la session.', error);
      setNotice(loginNotice, 'Impossible de vérifier la session. Rechargez la page.', 'error');
    });
}
