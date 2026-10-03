import { memories as defaultMemories } from './config.js';
import {
  CAPTION_MAX,
  clearFacePhoto,
  loadSouvenirFaces,
  resetFacePhoto,
  saveSouvenirText,
  uploadFacePhoto,
} from './lib/souvenirs.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

const SOURCE_LABELS = {
  default: 'Photo du projet',
  custom: 'Photo chargée',
  empty: 'Photo à venir',
};

// Onglet « Photos » de gestion.html : années, légendes et six faces par cube.
export function initSouvenirsAdmin(panel) {
  let cubes = [];
  let pendingClear = null;
  let busyFace = null;

  panel.innerHTML = `
    <section class="invite-list-panel souvenirs-admin">
      <div class="list-heading">
        <div>
          <p class="eyebrow">Cubes souvenirs</p>
          <h2>Photos, années et légendes</h2>
        </div>
        <button class="secondary-button" type="button" data-refresh-souvenirs>Actualiser</button>
      </div>
      <p class="team-help">Les photos sont réduites automatiquement avant l’envoi. Les changements apparaissent sur le site au prochain chargement de la page.</p>
      <div class="refresh-status" data-souvenirs-status aria-live="polite"></div>
      <div class="souvenir-cubes" data-souvenir-cubes></div>
    </section>
  `;

  const status = panel.querySelector('[data-souvenirs-status]');
  const cubesElement = panel.querySelector('[data-souvenir-cubes]');

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = `refresh-status${kind ? ` ${kind}` : ''}`;
  }

  function faceMarkup(cube, cubeIndex, face, faceIndex) {
    const key = `${cubeIndex}:${faceIndex}`;
    const busy = busyFace === key;
    const hasDefault = Boolean(defaultMemories[cubeIndex].photos[faceIndex]);
    const confirming = pendingClear === key;
    return `
      <li class="souvenir-face" data-cube="${cubeIndex}" data-face="${faceIndex}">
        <div class="face-thumb${face.url ? '' : ' is-empty'}">
          ${
            face.url
              ? `<img src="${escapeHtml(face.url)}" alt="${escapeHtml(cube.caption)}, photo ${faceIndex + 1}" loading="lazy">`
              : '<span>Photo à venir</span>'
          }
          ${busy ? '<span class="face-busy">Envoi…</span>' : ''}
        </div>
        <p class="face-meta"><strong>Face ${faceIndex + 1}</strong> · ${SOURCE_LABELS[face.source]}</p>
        <div class="face-actions">
          <label class="secondary-button face-upload${busy ? ' is-disabled' : ''}">
            ${face.url ? 'Remplacer' : 'Charger'}
            <input type="file" accept="image/*" data-upload ${busy ? 'disabled' : ''}>
          </label>
          ${
            face.source !== 'empty'
              ? `<button class="delete-button" type="button" data-clear ${busy ? 'disabled' : ''}>${confirming ? 'Confirmer' : 'Supprimer'}</button>`
              : ''
          }
          ${
            face.source !== 'default' && hasDefault
              ? `<button class="secondary-button" type="button" data-reset ${busy ? 'disabled' : ''}>Photo d’origine</button>`
              : ''
          }
        </div>
      </li>
    `;
  }

  function render() {
    cubesElement.innerHTML = cubes
      .map(
        (cube, cubeIndex) => `
          <article class="souvenir-cube">
            <form class="souvenir-text-form" data-text-form="${cubeIndex}">
              <p class="eyebrow">Cube ${cubeIndex + 1}</p>
              <label>Année<input name="year" type="number" min="1900" max="2100" required value="${escapeHtml(cube.year)}"></label>
              <label>Légende<input name="caption" maxlength="${CAPTION_MAX}" required value="${escapeHtml(cube.caption)}"></label>
              <button class="primary-button" type="submit">Enregistrer</button>
            </form>
            <ul class="souvenir-faces">
              ${cube.faces.map((face, faceIndex) => faceMarkup(cube, cubeIndex, face, faceIndex)).join('')}
            </ul>
          </article>
        `,
      )
      .join('');
  }

  async function refresh() {
    try {
      cubes = await loadSouvenirFaces(defaultMemories);
      pendingClear = null;
      render();
      setStatus('');
    } catch (error) {
      console.error('Impossible de charger les souvenirs.', error);
      setStatus(
        'Les souvenirs n’ont pas pu être chargés. Vérifiez que la migration des souvenirs a été exécutée.',
        'error',
      );
    }
  }

  async function runFaceAction(cubeIndex, faceIndex, action, successMessage) {
    busyFace = `${cubeIndex}:${faceIndex}`;
    pendingClear = null;
    render();
    try {
      await action(cubes[cubeIndex].faces[faceIndex].storagePath);
      busyFace = null;
      await refresh();
      setStatus(successMessage, 'success');
    } catch (error) {
      console.error('Action sur la photo impossible.', error);
      busyFace = null;
      render();
      setStatus('L’opération a échoué. Vérifiez la connexion et réessayez.', 'error');
    }
  }

  panel.addEventListener('change', (changeEvent) => {
    const input = changeEvent.target.closest('[data-upload]');
    const file = input?.files?.[0];
    if (!file) return;
    const face = input.closest('[data-face]');
    const cubeIndex = Number(face.dataset.cube);
    const faceIndex = Number(face.dataset.face);
    if (!file.type.startsWith('image/')) {
      setStatus('Choisissez un fichier image.', 'error');
      return;
    }
    runFaceAction(
      cubeIndex,
      faceIndex,
      (previousPath) => uploadFacePhoto(cubeIndex, faceIndex, file, previousPath),
      `Photo ${faceIndex + 1} du cube ${cubeIndex + 1} enregistrée.`,
    );
  });

  panel.addEventListener('click', (clickEvent) => {
    if (clickEvent.target.closest('[data-refresh-souvenirs]')) {
      refresh();
      return;
    }

    const face = clickEvent.target.closest('[data-face]');
    if (!face) return;
    const cubeIndex = Number(face.dataset.cube);
    const faceIndex = Number(face.dataset.face);
    const key = `${cubeIndex}:${faceIndex}`;

    if (clickEvent.target.closest('[data-clear]')) {
      // Premier clic : confirmation ; second clic : la face devient « Photo à venir ».
      if (pendingClear !== key) {
        pendingClear = key;
        render();
        return;
      }
      runFaceAction(
        cubeIndex,
        faceIndex,
        (previousPath) => clearFacePhoto(cubeIndex, faceIndex, previousPath),
        `Photo ${faceIndex + 1} du cube ${cubeIndex + 1} supprimée.`,
      );
    } else if (clickEvent.target.closest('[data-reset]')) {
      runFaceAction(
        cubeIndex,
        faceIndex,
        (previousPath) => resetFacePhoto(cubeIndex, faceIndex, previousPath),
        `Photo d’origine rétablie sur la face ${faceIndex + 1} du cube ${cubeIndex + 1}.`,
      );
    }
  });

  panel.addEventListener('submit', async (submitEvent) => {
    const form = submitEvent.target.closest('[data-text-form]');
    if (!form) return;
    submitEvent.preventDefault();
    const cubeIndex = Number(form.dataset.textForm);
    const year = Number(form.elements.year.value);
    const caption = form.elements.caption.value.trim();
    if (!Number.isInteger(year) || year < 1900 || year > 2100 || !caption) {
      setStatus('Indiquez une année entre 1900 et 2100 et une légende.', 'error');
      return;
    }

    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await saveSouvenirText(cubeIndex, year, caption);
      cubes[cubeIndex] = { ...cubes[cubeIndex], year, caption };
      setStatus(`Cube ${cubeIndex + 1} enregistré : ${year} · ${caption}.`, 'success');
    } catch (error) {
      console.error('Impossible d’enregistrer le souvenir.', error);
      setStatus('L’enregistrement a échoué. Réessayez.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  return { refresh };
}
