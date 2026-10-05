import {
  MUSIC_MAX_BYTES,
  MUSIC_TITLE_MAX,
  deleteMusic,
  listMusic,
  musicExtension,
  renameMusic,
  selectMusic,
  uploadMusic,
} from './lib/musique.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function titleFromFileName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, MUSIC_TITLE_MAX);
}

// Onglet « Musique » de gestion.html : charger, écouter, choisir, renommer, supprimer.
export function initMusiqueAdmin(panel) {
  let tracks = [];
  let pendingDelete = null;
  let busy = false;

  panel.innerHTML = `
    <section class="create-panel">
      <div>
        <p class="eyebrow">Musique de fond</p>
        <h2>Ajouter un morceau</h2>
      </div>
      <form class="music-upload-form" data-music-upload>
        <label>Fichier audio<input name="file" type="file" accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac" required></label>
        <label>Titre<input name="title" maxlength="${MUSIC_TITLE_MAX}" required placeholder="Ex. Notre chanson"></label>
        <button class="primary-button" type="submit">Ajouter</button>
      </form>
      <p class="team-help">Formats MP3 ou M4A, 20 Mo maximum. Utilisez une musique que vous avez le droit de diffuser.</p>
      <p class="notice" data-music-notice role="status" aria-live="polite"></p>
    </section>
    <section class="invite-list-panel">
      <div class="list-heading">
        <div>
          <p class="eyebrow">Sur le site</p>
          <h2 data-music-current>Aucune musique</h2>
        </div>
        <button class="secondary-button" type="button" data-music-stop hidden>Couper la musique du site</button>
      </div>
      <ul class="music-list" data-music-list></ul>
    </section>
  `;

  const uploadForm = panel.querySelector('[data-music-upload]');
  const notice = panel.querySelector('[data-music-notice]');
  const current = panel.querySelector('[data-music-current]');
  const stopButton = panel.querySelector('[data-music-stop]');
  const list = panel.querySelector('[data-music-list]');

  function setNotice(message, kind = '') {
    notice.textContent = message;
    notice.className = `notice${kind ? ` ${kind}` : ''}`;
  }

  function render() {
    const active = tracks.find((track) => track.active);
    current.textContent = active ? `En lecture : ${active.titre}` : 'Aucune musique';
    stopButton.hidden = !active;
    stopButton.disabled = busy;

    if (!tracks.length) {
      list.innerHTML = '<li class="empty-state">Aucun morceau chargé pour le moment.</li>';
      return;
    }

    list.innerHTML = tracks
      .map(
        (track) => `
          <li class="music-card${track.active ? ' is-active' : ''}" data-track="${track.id}">
            <form class="music-rename-form" data-rename>
              <label>Titre<input name="title" maxlength="${MUSIC_TITLE_MAX}" required value="${escapeHtml(track.titre)}"></label>
              <button class="secondary-button" type="submit" ${busy ? 'disabled' : ''}>Renommer</button>
            </form>
            <audio controls preload="none" src="${escapeHtml(track.url)}"></audio>
            <div class="music-actions">
              ${
                track.active
                  ? '<span class="music-badge">En lecture sur le site</span>'
                  : `<button class="primary-button" type="button" data-select ${busy ? 'disabled' : ''}>Choisir pour le site</button>`
              }
              <button class="delete-button" type="button" data-delete ${busy ? 'disabled' : ''}>
                ${pendingDelete === track.id ? 'Confirmer la suppression' : 'Supprimer'}
              </button>
            </div>
          </li>
        `,
      )
      .join('');
  }

  async function refresh() {
    try {
      tracks = await listMusic();
      pendingDelete = null;
      render();
    } catch (error) {
      console.error('Impossible de charger les musiques.', error);
      setNotice(
        'Les musiques n’ont pas pu être chargées. Vérifiez que la migration de la musique a été exécutée.',
        'error',
      );
    }
  }

  async function run(action, successMessage) {
    busy = true;
    render();
    try {
      await action();
      busy = false;
      await refresh();
      setNotice(successMessage, 'success');
    } catch (error) {
      console.error('Action sur la musique impossible.', error);
      busy = false;
      render();
      setNotice('L’opération a échoué. Vérifiez la connexion et réessayez.', 'error');
    }
  }

  uploadForm.elements.file.addEventListener('change', () => {
    const file = uploadForm.elements.file.files[0];
    if (file && !uploadForm.elements.title.value.trim()) {
      uploadForm.elements.title.value = titleFromFileName(file.name);
    }
  });

  uploadForm.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const file = uploadForm.elements.file.files[0];
    const title = uploadForm.elements.title.value.trim();
    if (!file || !title) return;
    if (!musicExtension(file)) {
      setNotice('Choisissez un fichier MP3 ou M4A.', 'error');
      return;
    }
    if (file.size > MUSIC_MAX_BYTES) {
      setNotice('Ce fichier dépasse 20 Mo.', 'error');
      return;
    }

    const submitButton = uploadForm.querySelector('button');
    submitButton.disabled = true;
    setNotice('Envoi du morceau…');
    try {
      const id = await uploadMusic(file, title);
      // Premier morceau (ou aucun choisi) : il joue directement sur le site.
      const autoSelect = !tracks.some((track) => track.active);
      if (autoSelect) await selectMusic(id);
      uploadForm.reset();
      await refresh();
      setNotice(
        autoSelect
          ? `« ${title} » ajouté et joué sur le site.`
          : `« ${title} » ajouté. Choisissez-le pour le faire jouer sur le site.`,
        'success',
      );
    } catch (error) {
      console.error('Impossible d’ajouter le morceau.', error);
      setNotice('L’envoi a échoué. Vérifiez le fichier et la connexion.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  stopButton.addEventListener('click', () =>
    run(() => selectMusic(null), 'La musique du site est coupée.'),
  );

  list.addEventListener('submit', (submitEvent) => {
    const form = submitEvent.target.closest('[data-rename]');
    if (!form) return;
    submitEvent.preventDefault();
    const id = form.closest('[data-track]').dataset.track;
    const title = form.elements.title.value.trim();
    if (!title) return;
    run(() => renameMusic(id, title), `Morceau renommé : « ${title} ».`);
  });

  list.addEventListener('click', (clickEvent) => {
    const card = clickEvent.target.closest('[data-track]');
    if (!card) return;
    const track = tracks.find((item) => item.id === card.dataset.track);
    if (!track) return;

    if (clickEvent.target.closest('[data-select]')) {
      run(() => selectMusic(track.id), `« ${track.titre} » joue maintenant sur le site.`);
    } else if (clickEvent.target.closest('[data-delete]')) {
      // Premier clic : confirmation ; second clic : suppression du fichier.
      if (pendingDelete !== track.id) {
        pendingDelete = track.id;
        render();
        return;
      }
      run(() => deleteMusic(track.id), `« ${track.titre} » supprimé.`);
    }
  });

  return { refresh };
}
