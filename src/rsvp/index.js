import { gsap } from 'gsap';
import { initRsvpForm } from './form.js';
import { createQrPattern, createQrPng } from './qr.js';
import {
  createGoogleCalendarUrl,
  downloadIcsFile,
} from './calendar.js';

const STORAGE_KEY = 'noces-rsvp';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

function createToken() {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => (byte % 36).toString(36))
    .join('')
    .slice(0, 6)
    .toUpperCase();

  return `S45-${token}`;
}

function readStoredResponse() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { response: null, error: null };

    const response = JSON.parse(saved);
    if (
      !response ||
      typeof response.name !== 'string' ||
      !['oui', 'non'].includes(response.presence) ||
      typeof response.token !== 'string'
    ) {
      throw new Error('Les données RSVP locales ont un format invalide.');
    }

    return { response, error: null };
  } catch (error) {
    console.error('Impossible de lire la réponse RSVP enregistrée.', error);
    return {
      response: null,
      error:
        'La réponse précédente ne peut pas être lue sur cet appareil. Vous pouvez envoyer une nouvelle réponse.',
    };
  }
}

export function initRsvp({ event, sceneReady }) {
  const confirmationDialog = document.querySelector('#confirm');
  const confirmationCard = document.querySelector('#confirm-card');
  const reopenButton = document.querySelector('#reopen-confirmation');
  const againNotice = document.querySelector('#again');
  const storageWarning = document.querySelector('#storage-warning');
  const cleanupCallbacks = [];
  const listeners = [];
  let scene = null;
  let currentResponse = null;
  let previousFocus = null;
  let returnFocusFrame = 0;

  function listen(element, type, handler) {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }

  function showStorageWarning(message) {
    storageWarning.textContent = message;
    storageWarning.hidden = !message;
  }

  function saveResponse(response) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
      showStorageWarning('');
      return true;
    } catch (error) {
      console.error('Impossible d’enregistrer la réponse RSVP localement.', error);
      showStorageWarning(
        'Votre navigateur n’a pas pu enregistrer cette réponse. Autorisez le stockage local puis réessayez.',
      );
      return false;
    }
  }

  function moveCanvasIntoDialog() {
    if (!scene) {
      throw new Error('La scène Three.js n’est pas encore prête.');
    }

    if (scene.canvas.parentElement !== confirmationDialog) {
      confirmationDialog.prepend(scene.canvas);
    }
  }

  function restoreCanvasToApp() {
    const app = document.querySelector('#app');
    const canvas = scene?.canvas;
    if (app && canvas && canvas.parentElement !== app) app.prepend(canvas);
  }

  function animateQrOut() {
    if (!scene) return;

    gsap.killTweensOf(scene.state, 'qr');
    gsap.killTweensOf(scene.uniforms.uQR);
    gsap.killTweensOf(scene.uniforms.uOpacity);
    gsap.killTweensOf(confirmationCard);
    gsap
      .timeline({
        onComplete() {
          if (confirmationDialog.open) confirmationDialog.close();
          restoreCanvasToApp();
        },
      })
      .to(scene.state, { qr: 0, duration: 1.2, ease: 'power2.inOut' }, 0.3)
      .to(
        scene.uniforms.uQR,
        { value: 0, duration: 1.6, ease: 'power2.inOut' },
        0.1,
      )
      .to(
        scene.uniforms.uOpacity,
        { value: 1, duration: 0.6, ease: 'none' },
        0,
      )
      .to(confirmationCard, { opacity: 0, y: 20, duration: 0.4 }, 0);
  }

  function closeConfirmation() {
    if (!confirmationDialog.open) return;
    if (currentResponse?.presence !== 'oui' || !scene) {
      gsap.to(confirmationCard, {
        opacity: 0,
        y: 20,
        duration: reducedMotion.matches ? 0 : 0.4,
        onComplete() {
          if (confirmationDialog.open) confirmationDialog.close();
        },
      });
      return;
    }
    animateQrOut();
  }

  async function openConfirmation(response) {
    currentResponse = response;
    previousFocus = document.activeElement;
    document.body.classList.add('locked');

    if (response.presence === 'oui') {
      const [qrImageUrl, qrPattern, readyScene] = await Promise.all([
        createQrPng(response.token),
        createQrPattern(response.token),
        sceneReady,
      ]);
      const calendarUrl = createGoogleCalendarUrl(response);
      const guests = response.guests
        .map(
          (guest) =>
            `<li><span>${escapeHtml(guest.name)}</span><span>${escapeHtml(guest.drink)}</span></li>`,
        )
        .join('');
      const notes = response.notes
        ? `<p class="note">Allergies : ${escapeHtml(response.notes)}</p>`
        : '';

      confirmationCard.innerHTML = `
        <h2 id="confirm-title">Merci, ${escapeHtml(response.name)}</h2>
        <p class="lede">Votre présence est confirmée. Présentez ce code à l’entrée.</p>
        <div class="qrbox"><img src="${qrImageUrl}" alt="Code QR d’entrée ${escapeHtml(response.token)}"></div>
        <p class="token">${escapeHtml(response.token)}</p>
        <ul class="summary">
          ${guests}
          <li><span>Table</span><span>Attribuée par les hôtes</span></li>
        </ul>
        ${notes}
        <p class="note">Faites une capture d’écran de ce code pour l’avoir avec vous le jour venu.</p>
        <a class="cta qr-download" href="${qrImageUrl}" download="${escapeHtml(response.token)}.png">Enregistrer mon code QR</a>
        <a class="btn-ghost" href="${escapeHtml(calendarUrl)}" target="_blank" rel="noopener">Ajouter à Google Agenda</a>
        <button class="btn-ghost" type="button" data-download-ics>Ajouter à mon calendrier (.ics)</button>
        <button class="btn-ghost" type="button" data-close-confirmation>Revenir au site</button>
      `;

      if (!readyScene) {
        throw new Error('La scène Three.js n’a pas pu être chargée.');
      }
      scene = readyScene;
      scene.setQrPattern(qrPattern);
    } else {
      confirmationCard.innerHTML = `
        <h2 id="confirm-title">Merci, ${escapeHtml(response.name)}</h2>
        <p class="lede">Votre réponse a bien été reçue. Vous nous manquerez, et le couple sera touché de votre attention.</p>
        <button class="btn-ghost" type="button" data-close-confirmation>Revenir au site</button>
      `;
    }

    gsap.killTweensOf(confirmationCard);
    gsap.set(confirmationCard, { opacity: 0, y: 30 });
    if (response.presence === 'oui') moveCanvasIntoDialog();
    if (!confirmationDialog.open) confirmationDialog.showModal();
    againNotice.hidden = false;

    if (response.presence === 'oui' && scene) {
      const reduce = reducedMotion.matches;
      gsap.killTweensOf(scene.state, 'qr');
      gsap.killTweensOf(scene.uniforms.uQR);
      gsap.killTweensOf(scene.uniforms.uOpacity);
      gsap.killTweensOf(scene.state, 'introProgress');
      scene.state.introProgress = 1;
      scene.state.qr = 0;
      scene.uniforms.uQR.value = 0;
      scene.uniforms.uOpacity.value = 1;

      const timeline = gsap.timeline({
        onComplete() {
          confirmationCard
            .querySelector('[data-close-confirmation]')
            ?.focus({ preventScroll: true });
        },
      });
      timeline
        .to(
          scene.state,
          { qr: 1, duration: 1.1, ease: 'power2.inOut' },
          0,
        )
        .to(
          scene.uniforms.uQR,
          {
            value: 1,
            duration: reduce ? 0.6 : 2.6,
            ease: 'power2.inOut',
          },
          0.2,
        )
        .to(
          scene.uniforms.uOpacity,
          { value: 0, duration: 0.8 },
          reduce ? 1 : 3.1,
        )
        .to(
          confirmationCard,
          { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
          reduce ? 0.9 : 2.9,
        );
    } else {
      gsap.timeline({
        onComplete() {
          confirmationCard
            .querySelector('[data-close-confirmation]')
            ?.focus({ preventScroll: true });
        },
      }).to(confirmationCard, { opacity: 1, y: 0, duration: 0.9 }, 0.4);
    }
  }

  function submitResponse(data) {
    const response = { ...data, token: createToken() };
    if (!saveResponse(response)) return;

    openConfirmation(response).catch((error) => {
      console.error('Impossible d’afficher la confirmation RSVP.', error);
      showStorageWarning(
        'Votre réponse est enregistrée, mais son écran de confirmation n’a pas pu être affiché.',
      );
    });
  }

  const form = initRsvpForm({ onSubmit: submitResponse });
  cleanupCallbacks.push(form.cleanup);

  listen(confirmationCard, 'click', (clickEvent) => {
    if (clickEvent.target.closest('[data-close-confirmation]')) {
      closeConfirmation();
    }
    if (clickEvent.target.closest('[data-download-ics]') && currentResponse) {
      downloadIcsFile(currentResponse);
    }
  });
  listen(confirmationDialog, 'click', (clickEvent) => {
    if (clickEvent.target === confirmationDialog) closeConfirmation();
  });
  listen(confirmationDialog, 'close', () => {
    document.body.classList.remove('locked');
    restoreCanvasToApp();
    cancelAnimationFrame(returnFocusFrame);
    returnFocusFrame = requestAnimationFrame(() => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    });
  });
  listen(reopenButton, 'click', () => {
    if (currentResponse) {
      openConfirmation(currentResponse).catch((error) => {
        console.error('Impossible de réouvrir la confirmation RSVP.', error);
        showStorageWarning(
          'La confirmation enregistrée n’a pas pu être rouverte. Rechargez la page et réessayez.',
        );
      });
    }
  });

  const stored = readStoredResponse();
  if (stored.response) {
    currentResponse = stored.response;
    form.fill(stored.response);
    againNotice.hidden = false;
  }
  if (stored.error) showStorageWarning(stored.error);

  return {
    setScene(sceneApi) {
      scene = sceneApi;
      if (currentResponse?.presence === 'oui' && confirmationDialog.open) {
        createQrPattern(currentResponse.token).then((pattern) => {
          scene.setQrPattern(pattern);
        }).catch((error) => {
          console.error('Impossible de restaurer les particules du code QR.', error);
        });
      }
    },
    cleanup() {
      cleanupCallbacks.forEach((cleanup) => cleanup());
      listeners.forEach((removeListener) => removeListener());
      cancelAnimationFrame(returnFocusFrame);
      if (confirmationDialog.open) confirmationDialog.close();
      restoreCanvasToApp();
    },
  };
}
