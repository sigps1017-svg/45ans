import './accueil.css';
import { Html5Qrcode } from 'html5-qrcode';
import {
  getCurrentSession,
  getStaffInviteByToken,
  getStaffRole,
  loadStaffData,
  signInStaff,
  signOutStaff,
  updateArrival,
} from './lib/staff.js';
import { supabaseConfigError, getSupabaseClient } from './lib/supabase.js';

const root = document.querySelector('#staff-app');
const REFRESH_INTERVAL = 15_000;
const AUTO_RETURN_DELAY = 6_000;

root.innerHTML = `
  <header class="staff-header">
    <div class="staff-brand">
      <span class="staff-kicker">Noces de vermeil · 45 ans</span>
      <h1>Accueil des invités</h1>
    </div>
    <button class="arrival-counter" id="arrival-counter" type="button" hidden aria-label="Ouvrir les listes d’accueil">
      <strong id="arrival-count">0 / 0</strong>
      <span>personnes arrivées</span>
      <span class="counter-hint">Voir les listes</span>
    </button>
    <a class="text-button admin-link" id="admin-link" href="/gestion.html" hidden>Gestion des invitations</a>
    <button class="text-button" type="button" id="sign-out" hidden>Déconnexion</button>
  </header>
  <main>
    <section class="login-panel" id="login-panel" aria-labelledby="login-title">
      <h2 id="login-title">Connexion de l’équipe</h2>
      <p>Utilisez le compte qui vous a été attribué pour l’accueil.</p>
      <form id="login-form">
        <label for="email">Courriel</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Mot de passe</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="primary-button" type="submit" id="login-submit">Se connecter</button>
      </form>
      <p class="message" id="login-message" role="alert" aria-live="assertive"></p>
    </section>
    <section id="staff-panel" hidden>
      <div class="tools-grid">
        <section class="scanner-panel" aria-labelledby="scanner-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">Scanner</p>
              <h2 id="scanner-title">Lire le code d’invitation</h2>
            </div>
            <span class="connection-state" id="camera-state">Caméra inactive</span>
          </div>
          <div id="qr-reader"></div>
          <p class="message" id="scan-message" role="status" aria-live="polite">
            Autorisez l’accès à la caméra pour commencer.
          </p>
          <button class="secondary-button" type="button" id="camera-toggle">Activer la caméra</button>
          <label class="manual-label" for="manual-token">Ou saisir un code d’invitation</label>
          <form class="manual-form" id="manual-form">
            <input id="manual-token" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Code du QR" aria-label="Code du QR">
            <button class="secondary-button" type="submit">Rechercher</button>
          </form>
        </section>
        <section class="search-panel" aria-labelledby="search-title">
          <p class="section-kicker">Recherche</p>
          <h2 id="search-title">Invité sans téléphone ?</h2>
          <label class="visually-hidden" for="name-search">Rechercher un foyer par nom</label>
          <input id="name-search" type="search" autocomplete="off" placeholder="Nom du foyer…">
          <ul id="search-results" class="search-results" aria-live="polite"></ul>
        </section>
      </div>
      <section class="result-panel" id="result-panel" aria-live="polite" hidden>
        <div id="result-content"></div>
        <div class="result-actions" id="result-actions"></div>
      </section>
    </section>
  </main>
  <section class="roster-overlay" id="roster-overlay" role="dialog" aria-modal="true" aria-labelledby="roster-title" hidden>
    <div class="roster-shell">
      <header class="roster-header">
        <div>
          <p class="section-kicker">Suivi de l’accueil</p>
          <h2 id="roster-title">Listes des invités</h2>
        </div>
        <button class="roster-close" type="button" id="roster-close" aria-label="Fermer et revenir au scanner">Fermer <span aria-hidden="true">×</span></button>
      </header>
      <div class="roster-tabs" role="tablist" aria-label="État des invités">
        <button class="roster-tab" id="tab-arrived" type="button" role="tab" aria-selected="true" aria-controls="roster-list" data-roster-tab="arrived">Arrivés <span data-roster-count="arrived">0</span></button>
        <button class="roster-tab" id="tab-pending" type="button" role="tab" aria-selected="false" aria-controls="roster-list" data-roster-tab="pending" tabindex="-1">En attente <span data-roster-count="pending">0</span></button>
        <button class="roster-tab" id="tab-unanswered" type="button" role="tab" aria-selected="false" aria-controls="roster-list" data-roster-tab="unanswered" tabindex="-1">Sans réponse <span data-roster-count="unanswered">0</span></button>
      </div>
      <div class="roster-filters">
        <label for="roster-search">Rechercher un foyer</label>
        <input id="roster-search" type="search" autocomplete="off" placeholder="Nom du foyer…">
        <label for="roster-table-filter">Filtrer par table</label>
        <select id="roster-table-filter">
          <option value="all">Toutes les tables</option>
        </select>
      </div>
      <div class="roster-list-wrap">
        <ul class="roster-list" id="roster-list" role="tabpanel" aria-labelledby="tab-arrived" tabindex="0"></ul>
      </div>
    </div>
  </section>
  <footer>Une soirée de famille, accueillie avec amour</footer>
`;

const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const loginSubmit = document.querySelector('#login-submit');
const staffPanel = document.querySelector('#staff-panel');
const signOutButton = document.querySelector('#sign-out');
const adminLink = document.querySelector('#admin-link');
const arrivalCounter = document.querySelector('#arrival-counter');
const arrivalCount = document.querySelector('#arrival-count');
const rosterOverlay = document.querySelector('#roster-overlay');
const rosterCloseButton = document.querySelector('#roster-close');
const rosterSearch = document.querySelector('#roster-search');
const rosterTableFilter = document.querySelector('#roster-table-filter');
const rosterList = document.querySelector('#roster-list');
const rosterTabs = Array.from(document.querySelectorAll('[data-roster-tab]'));
const cameraToggle = document.querySelector('#camera-toggle');
const cameraState = document.querySelector('#camera-state');
const scanMessage = document.querySelector('#scan-message');
const resultPanel = document.querySelector('#result-panel');
const resultContent = document.querySelector('#result-content');
const resultActions = document.querySelector('#result-actions');
const searchInput = document.querySelector('#name-search');
const searchResults = document.querySelector('#search-results');
const manualForm = document.querySelector('#manual-form');
const manualToken = document.querySelector('#manual-token');

let scanner = null;
let scannerRunning = false;
let scannerStartPromise = null;
let scannerShouldRun = false;
let scanInProgress = false;
let isAuthorized = false;
let inviteCache = [];
let displayedInvite = null;
let autoReturnTimer = 0;
let refreshTimer = 0;
let authSubscription = null;
let rosterTab = 'arrived';
let rosterFocusTarget = null;

function setMessage(element, message, kind = '') {
  element.textContent = message;
  element.className = `message${kind ? ` ${kind}` : ''}`;
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

function formatArrival(date) {
  return new Intl.DateTimeFormat('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function updateCounter(data) {
  arrivalCount.textContent = `${data.arrived} / ${data.expected}`;
  arrivalCounter.hidden = false;
  inviteCache = data.invites;
  renderSearchResults();
  if (displayedInvite) {
    const refreshed = inviteCache.find((invite) => invite.id === displayedInvite.id);
    if (refreshed) displayedInvite = refreshed;
  }
  renderRoster();
}

async function refreshDashboard() {
  const data = await loadStaffData();
  updateCounter(data);
}

function normalizeSearch(value) {
  return value
    .trim()
    .toLocaleLowerCase('fr-CA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getRosterGroups() {
  const arrived = inviteCache
    .filter(
      (invite) =>
        invite.response?.presence === 'oui' && invite.response.checked_in_at,
    )
    .sort(
      (first, second) =>
        new Date(second.response.checked_in_at).getTime() -
        new Date(first.response.checked_in_at).getTime(),
    );
  const pending = inviteCache
    .filter(
      (invite) =>
        invite.response?.presence === 'oui' && !invite.response.checked_in_at,
    )
    .sort((first, second) =>
      first.nom_foyer.localeCompare(second.nom_foyer, 'fr-CA'),
    );
  const unanswered = inviteCache
    .filter((invite) => !invite.response)
    .sort((first, second) =>
      first.nom_foyer.localeCompare(second.nom_foyer, 'fr-CA'),
    );
  return { arrived, pending, unanswered };
}

function updateRosterTabs(groups) {
  rosterTabs.forEach((tab) => {
    const name = tab.dataset.rosterTab;
    tab.querySelector('[data-roster-count]')?.remove();
    const count = document.createElement('span');
    count.dataset.rosterCount = name;
    count.textContent = String(groups[name].length);
    count.setAttribute('aria-label', `${groups[name].length} foyers`);
    tab.append(count);
  });
}

function updateRosterTableOptions() {
  const selectedTable = rosterTableFilter.value;
  const tableNumbers = [
    ...new Set(
      inviteCache
        .map((invite) => invite.table_num)
        .filter((table) => table !== null && table !== undefined),
    ),
  ].sort((first, second) => Number(first) - Number(second));
  rosterTableFilter.replaceChildren(
    new Option('Toutes les tables', 'all'),
    ...tableNumbers.map((table) => new Option(`Table ${table}`, String(table))),
    new Option('Sans table attribuée', 'none'),
  );

  if ([...rosterTableFilter.options].some((option) => option.value === selectedTable)) {
    rosterTableFilter.value = selectedTable;
  }
}

function renderRoster() {
  if (rosterOverlay.hidden) return;

  const groups = getRosterGroups();
  updateRosterTabs(groups);
  updateRosterTableOptions();
  rosterList.setAttribute('aria-labelledby', `tab-${rosterTab}`);

  const query = normalizeSearch(rosterSearch.value);
  const tableFilter = rosterTableFilter.value;
  const filtered = groups[rosterTab].filter((invite) => {
    const matchesName = normalizeSearch(invite.nom_foyer).includes(query);
    const matchesTable =
      tableFilter === 'all' ||
      (tableFilter === 'none'
        ? invite.table_num === null || invite.table_num === undefined
        : String(invite.table_num) === tableFilter);
    return matchesName && matchesTable;
  });

  rosterList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('li');
    empty.className = 'roster-empty';
    empty.textContent = query || tableFilter !== 'all'
      ? 'Aucun foyer ne correspond à ces filtres.'
      : 'Aucun foyer dans cette liste pour le moment.';
    rosterList.append(empty);
    return;
  }

  filtered.forEach((invite) => {
    const response = invite.response;
    const peopleCount =
      response?.presence === 'oui' ? response.invites_detail.length : 0;
    const table = invite.table_num ? `Table ${invite.table_num}` : 'Table à attribuer';
    const secondary =
      rosterTab === 'arrived'
        ? `${table} · ${peopleCount} personne${peopleCount === 1 ? '' : 's'} · Arrivée à ${formatArrival(response.checked_in_at)}`
        : rosterTab === 'pending'
          ? `${table} · ${peopleCount} personne${peopleCount === 1 ? '' : 's'}`
          : `${table} · ${invite.places_max} place${invite.places_max === 1 ? '' : 's'} réservée${invite.places_max === 1 ? '' : 's'}`;

    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roster-row';
    button.dataset.inviteId = invite.id;
    button.innerHTML = `
      <span class="roster-row-name">${escapeHtml(invite.nom_foyer)}</span>
      <span class="roster-row-details">${escapeHtml(secondary)}</span>
      <span class="roster-row-chevron" aria-hidden="true">›</span>
    `;
    item.append(button);
    rosterList.append(item);
  });
}

async function openRoster() {
  rosterFocusTarget = document.activeElement;
  window.clearTimeout(autoReturnTimer);
  stopScanner().catch((error) => {
    console.error('Impossible de suspendre la caméra pour afficher les listes.', error);
  });
  resultPanel.hidden = true;
  displayedInvite = null;
  rosterOverlay.hidden = false;
  document.body.classList.add('roster-open');
  renderRoster();
  rosterCloseButton.focus({ preventScroll: true });
}

function closeRoster({ returnToScanner = true, restoreFocus = true } = {}) {
  if (rosterOverlay.hidden) return;
  rosterOverlay.hidden = true;
  document.body.classList.remove('roster-open');
  if (returnToScanner && isAuthorized) {
    startScanner().finally(() => manualToken.focus({ preventScroll: true }));
  } else if (restoreFocus && rosterFocusTarget instanceof HTMLElement) {
    rosterFocusTarget.focus({ preventScroll: true });
  }
}

async function stopScanner() {
  scannerShouldRun = false;
  if (scannerStartPromise) await scannerStartPromise;
  if (scanner && scannerRunning) {
    await scanner.stop();
    scannerRunning = false;
    cameraToggle.textContent = 'Activer la caméra';
    cameraState.textContent = 'Caméra inactive';
  }
}

async function startScanner() {
  if (!isAuthorized || scannerRunning) return;
  scannerShouldRun = true;
  if (scannerStartPromise) return scannerStartPromise;
  if (!scanner) scanner = new Html5Qrcode('qr-reader', { verbose: false });

  cameraToggle.disabled = true;
  setMessage(scanMessage, 'Démarrage de la caméra…');
  scannerStartPromise = (async () => {
    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          aspectRatio: 1,
          qrbox(viewfinderWidth, viewfinderHeight) {
            const edge = Math.min(viewfinderWidth, viewfinderHeight, 300);
            return { width: edge, height: edge };
          },
        },
        (decodedText) => {
          if (scanInProgress) return;
          scanInProgress = true;
          scanMessage.textContent = 'Code lu.';
          handleLookup(decodedText.trim());
        },
        () => {},
      );
      scannerRunning = true;
      if (!scannerShouldRun || !isAuthorized || !rosterOverlay.hidden) {
        await scanner.stop();
        scannerRunning = false;
        cameraToggle.textContent = 'Activer la caméra';
        cameraState.textContent = 'Caméra inactive';
        return;
      }
      cameraToggle.textContent = 'Désactiver la caméra';
      cameraState.textContent = 'Caméra active';
      setMessage(scanMessage, 'Pointez la caméra vers le code QR.');
    } catch (error) {
      console.error('Impossible de démarrer la caméra.', error);
      cameraState.textContent = 'Caméra indisponible';
      setMessage(
        scanMessage,
        'La caméra est inaccessible. Vérifiez la permission et HTTPS, ou utilisez la saisie/recherche ci-dessous.',
        'error',
      );
    } finally {
      scannerStartPromise = null;
      cameraToggle.disabled = false;
    }
  })();
  return scannerStartPromise;
}

function renderRedResult(title, description) {
  resultPanel.hidden = false;
  resultPanel.className = 'result-panel result-red';
  resultContent.innerHTML = `
    <p class="result-status">Vérification requise</p>
    <h2>${escapeHtml(title)}</h2>
    <p class="result-description">${escapeHtml(description)}</p>
  `;
  resultActions.innerHTML =
    '<button class="secondary-button next-button" type="button" data-next>Scanner le suivant</button>';
  resultActions.querySelector('[data-next]')?.focus({ preventScroll: true });
  scheduleAutoReturn();
}

function renderInvite(invite) {
  displayedInvite = invite;
  resultPanel.hidden = false;
  resultActions.innerHTML = '';

  if (!invite) {
    renderRedResult('Code inconnu', 'Aucune invitation ne correspond à ce code.');
    return;
  }

  const response = invite.response;
  if (!response || response.presence !== 'oui') {
    renderRedResult(
      invite.nom_foyer,
      response
        ? 'La réponse enregistrée indique une absence. Veuillez vérifier auprès des hôtes.'
        : 'Aucune réponse n’a été enregistrée pour cette invitation.',
    );
    return;
  }

  if (response.checked_in_at) {
    resultPanel.className = 'result-panel result-orange';
    resultContent.innerHTML = `
      <p class="result-status">Déjà arrivé · ${escapeHtml(formatArrival(response.checked_in_at))}</p>
      <h2>${escapeHtml(invite.nom_foyer)}</h2>
      <p class="result-description">${escapeHtml(response.invites_detail.length)} personne${response.invites_detail.length === 1 ? '' : 's'} · Table ${invite.table_num ? escapeHtml(invite.table_num) : 'à attribuer'}</p>
    `;
    resultActions.innerHTML = `
      <button class="secondary-button next-button" type="button" data-next>Scanner le suivant</button>
      <button class="undo-button" type="button" data-undo>Annuler l’arrivée</button>
    `;
    resultActions.querySelector('[data-next]')?.focus({ preventScroll: true });
    scheduleAutoReturn();
    return;
  }

  const guestList = response.invites_detail
    .map(
      (guest) =>
        `<li><strong>${escapeHtml(guest.name)}</strong><span>${escapeHtml(guest.drink)}</span></li>`,
    )
    .join('');
  const allergyText = response.allergies
    ? escapeHtml(response.allergies)
    : 'Aucune allergie signalée';
  resultPanel.className = 'result-panel result-green';
  resultContent.innerHTML = `
    <p class="result-status">Invitation confirmée</p>
    <h2>${escapeHtml(invite.nom_foyer)}</h2>
    <div class="result-facts">
      <p><span>Table</span><strong>${invite.table_num ? escapeHtml(invite.table_num) : 'À attribuer'}</strong></p>
      <p><span>Personnes</span><strong>${escapeHtml(response.invites_detail.length)}</strong></p>
    </div>
    <ul class="guest-list">${guestList}</ul>
    <p class="allergies"><span>Allergies</span><strong>${allergyText}</strong></p>
  `;
  resultActions.innerHTML =
    '<button class="primary-button confirm-button" type="button" data-confirm>Confirmer l’arrivée</button>';
  window.clearTimeout(autoReturnTimer);
  resultActions.querySelector('[data-confirm]')?.focus({ preventScroll: true });
}

function scheduleAutoReturn() {
  window.clearTimeout(autoReturnTimer);
  autoReturnTimer = window.setTimeout(() => {
    resetForNextInvite();
  }, AUTO_RETURN_DELAY);
}

async function handleLookup(rawToken) {
  window.clearTimeout(autoReturnTimer);
  await stopScanner().catch((error) => {
    console.error('Impossible d’arrêter la caméra après la lecture.', error);
  });

  const token = rawToken.toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(token)) {
    renderRedResult('Code invalide', 'Le code saisi ne correspond pas à un token d’invitation.');
    return;
  }

  setMessage(scanMessage, 'Recherche de l’invitation…');
  try {
    const invite = await getStaffInviteByToken(token);
    renderInvite(invite);
    if (invite) {
      inviteCache = inviteCache.map((cached) =>
        cached.id === invite.id ? invite : cached,
      );
    }
  } catch (error) {
    console.error('Impossible de rechercher cette invitation.', error);
    renderRedResult(
      'Recherche impossible',
      'Vérifiez la connexion réseau puis réessayez.',
    );
  }
}

async function setArrival(checkedInAt) {
  if (!displayedInvite?.response) return;
  const actionButtons = Array.from(resultActions.querySelectorAll('button'));
  actionButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const result = await updateArrival(displayedInvite.id, checkedInAt);
    displayedInvite.response.checked_in_at = result.checked_in_at;
    updateCounter(await loadStaffData());
    renderInvite(displayedInvite);
    if (!checkedInAt) {
      setMessage(scanMessage, 'Arrivée annulée.');
    } else {
      setMessage(scanMessage, 'Arrivée confirmée.');
    }
    scheduleAutoReturn();
  } catch (error) {
    console.error('Impossible de mettre à jour l’arrivée.', error);
    actionButtons.forEach((button) => {
      button.disabled = false;
    });
    setMessage(
      scanMessage,
      'La mise à jour a échoué. Vérifiez la connexion et réessayez.',
      'error',
    );
  }
}

async function resetForNextInvite() {
  window.clearTimeout(autoReturnTimer);
  resultPanel.hidden = true;
  resultPanel.className = 'result-panel';
  resultContent.replaceChildren();
  resultActions.replaceChildren();
  displayedInvite = null;
  scanInProgress = false;
  manualToken.value = '';
  if (isAuthorized) {
    await startScanner();
    manualToken.focus({ preventScroll: true });
  }
}

function renderSearchResults() {
  const query = searchInput.value.trim().toLocaleLowerCase('fr-CA');
  searchResults.replaceChildren();
  if (query.length < 2) return;

  const matches = inviteCache
    .filter((invite) => invite.nom_foyer.toLocaleLowerCase('fr-CA').includes(query))
    .slice(0, 8);

  if (!matches.length) {
    const empty = document.createElement('li');
    empty.className = 'search-empty';
    empty.textContent = 'Aucun foyer correspondant.';
    searchResults.append(empty);
    return;
  }

  matches.forEach((invite) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const response = invite.response;
    const headcount =
      response?.presence === 'oui' ? response.invites_detail.length : 0;
    button.type = 'button';
    button.className = 'search-result';
    button.innerHTML = `
      <strong>${escapeHtml(invite.nom_foyer)}</strong>
      <span>${headcount} personne${headcount === 1 ? '' : 's'} · ${response?.presence === 'oui' ? 'Présence confirmée' : 'Sans réponse/absence'}</span>
    `;
    button.addEventListener('click', () => {
      searchInput.value = '';
      searchResults.replaceChildren();
      renderInvite(invite);
      stopScanner().catch((error) => {
        console.error('Impossible d’arrêter la caméra après la recherche.', error);
      });
    });
    item.append(button);
    searchResults.append(item);
  });
}

async function authorizeSession(session) {
  if (!session?.user) {
    loginPanel.hidden = false;
    staffPanel.hidden = true;
    signOutButton.hidden = true;
    adminLink.hidden = true;
    arrivalCounter.hidden = true;
    return;
  }

  loginPanel.hidden = true;
  setMessage(loginMessage, '');
  try {
    const role = await getStaffRole(session.user.id);
    if (!role) {
      await signOutStaff();
      loginPanel.hidden = false;
      staffPanel.hidden = true;
      setMessage(
        loginMessage,
        'Ce compte n’est pas autorisé pour l’accueil. Demandez aux hôtes de l’ajouter à l’équipe.',
        'error',
      );
      return;
    }

    isAuthorized = true;
    staffPanel.hidden = false;
    signOutButton.hidden = false;
    adminLink.hidden = role !== 'admin';
    await refreshDashboard();
    await startScanner();
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      refreshDashboard().catch((error) => {
        console.error('Impossible d’actualiser le tableau d’accueil.', error);
        setMessage(scanMessage, 'Actualisation impossible. Vérifiez le réseau.', 'error');
      });
    }, REFRESH_INTERVAL);
  } catch (error) {
    console.error('Impossible de vérifier l’accès de l’équipe.', error);
    loginPanel.hidden = false;
    staffPanel.hidden = true;
    setMessage(
      loginMessage,
      'La connexion ou la vérification de l’équipe a échoué. Vérifiez le réseau puis réessayez.',
      'error',
    );
  }
}

loginForm.addEventListener('submit', async (submitEvent) => {
  submitEvent.preventDefault();
  loginSubmit.disabled = true;
  setMessage(loginMessage, 'Connexion en cours…');
  try {
    const formData = new FormData(loginForm);
    const session = await signInStaff(
      String(formData.get('email')).trim(),
      String(formData.get('password')),
    );
    await authorizeSession(session);
  } catch (error) {
    console.error('Échec de connexion de l’équipe.', error);
    setMessage(
      loginMessage,
      'Connexion impossible. Vérifiez le courriel et le mot de passe.',
      'error',
    );
  } finally {
    loginSubmit.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  try {
    await stopScanner();
    await signOutStaff();
    isAuthorized = false;
    window.clearInterval(refreshTimer);
    staffPanel.hidden = true;
    arrivalCounter.hidden = true;
    signOutButton.hidden = true;
    adminLink.hidden = true;
    loginPanel.hidden = false;
  } catch (error) {
    console.error('Impossible de fermer la session de l’équipe.', error);
    setMessage(scanMessage, 'Déconnexion impossible. Réessayez.', 'error');
  }
});

cameraToggle.addEventListener('click', () => {
  if (scannerRunning) {
    stopScanner()
      .then(() => {
        cameraToggle.textContent = 'Activer la caméra';
        cameraState.textContent = 'Caméra inactive';
        setMessage(scanMessage, 'Caméra arrêtée. Vous pouvez saisir ou rechercher un nom.');
      })
      .catch((error) => {
        console.error('Impossible d’arrêter la caméra.', error);
        setMessage(scanMessage, 'La caméra n’a pas pu être arrêtée.', 'error');
      });
  } else {
    startScanner();
  }
});

manualForm.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault();
  if (!manualToken.value.trim()) {
    manualToken.focus();
    return;
  }
  scanInProgress = true;
  handleLookup(manualToken.value.trim());
});

searchInput.addEventListener('input', renderSearchResults);

arrivalCounter.addEventListener('click', () => {
  openRoster();
});

rosterCloseButton.addEventListener('click', () => closeRoster());
rosterSearch.addEventListener('input', renderRoster);
rosterTableFilter.addEventListener('change', renderRoster);

rosterTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    rosterTab = tab.dataset.rosterTab;
    rosterTabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    renderRoster();
    rosterList.focus({ preventScroll: true });
  });
  tab.addEventListener('keydown', (keyEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyEvent.key)) {
      return;
    }
    keyEvent.preventDefault();
    const nextIndex =
      keyEvent.key === 'Home'
        ? 0
        : keyEvent.key === 'End'
          ? rosterTabs.length - 1
          : (index + (keyEvent.key === 'ArrowRight' ? 1 : -1) + rosterTabs.length) %
            rosterTabs.length;
    rosterTabs[nextIndex].click();
    rosterTabs[nextIndex].focus();
  });
});

rosterList.addEventListener('click', (clickEvent) => {
  const row = clickEvent.target.closest('[data-invite-id]');
  if (!row) return;
  const invite = inviteCache.find((item) => item.id === row.dataset.inviteId);
  if (!invite) return;

  window.clearTimeout(autoReturnTimer);
  closeRoster({ returnToScanner: false, restoreFocus: false });
  displayedInvite = invite;
  scanInProgress = true;
  renderInvite(invite);
});

window.addEventListener('keydown', (keyEvent) => {
  if (keyEvent.key === 'Escape' && !rosterOverlay.hidden) {
    closeRoster();
  }
});

resultActions.addEventListener('click', (clickEvent) => {
  if (clickEvent.target.closest('[data-confirm]')) {
    setArrival(new Date().toISOString());
  } else if (clickEvent.target.closest('[data-undo]')) {
    setArrival(null);
  } else if (clickEvent.target.closest('[data-next]')) {
    resetForNextInvite();
  }
});

if (supabaseConfigError) {
  loginSubmit.disabled = true;
  setMessage(loginMessage, supabaseConfigError, 'error');
}

if (!supabaseConfigError) {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    if (!session) {
      isAuthorized = false;
      window.clearInterval(refreshTimer);
      staffPanel.hidden = true;
      arrivalCounter.hidden = true;
      loginPanel.hidden = false;
      adminLink.hidden = true;
    }
  });
  authSubscription = subscription;

  getCurrentSession()
    .then((session) => authorizeSession(session))
    .catch((error) => {
      console.error('Impossible de restaurer la session de l’équipe.', error);
      setMessage(loginMessage, 'Impossible de vérifier la session. Rechargez la page.', 'error');
    });
}

window.addEventListener(
  'pagehide',
  async () => {
    window.clearInterval(refreshTimer);
    window.clearTimeout(autoReturnTimer);
    authSubscription?.unsubscribe();
    try {
      if (scannerRunning) await scanner?.stop();
      scanner?.clear();
    } catch (error) {
      console.error('Impossible de libérer la caméra.', error);
    }
  },
  { once: true },
);
