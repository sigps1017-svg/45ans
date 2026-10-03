import {
  GUESTBOOK_MESSAGE_MAX,
  GUESTBOOK_SIGNATURE_MAX,
  getGuestbookEntry,
  submitGuestbookEntry,
} from '../lib/livre-or.js';
import { supabaseConfigError } from '../lib/supabase.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function createGuestbookMarkup(event) {
  return `
    <section id="livre-or" aria-labelledby="livre-or-title">
      <div class="panel">
        <h2 id="livre-or-title">Livre d’or</h2>
        <p class="lede">Laissez un mot à ${escapeHtml(event.hosts.join(' et '))}. Tous les messages seront réunis dans leur livre d’or.</p>
        <p class="invite-status" id="guestbook-status" role="status" aria-live="polite">Chargement du livre d’or…</p>
        <form id="guestbook-form" novalidate hidden>
          <label class="field" for="guestbook-message">
            <span>Votre message</span>
            <textarea id="guestbook-message" name="message" rows="6" maxlength="${GUESTBOOK_MESSAGE_MAX}" required placeholder="Vos vœux, un souvenir partagé, quelques mots du cœur…"></textarea>
            <small class="field-count" id="guestbook-count" aria-live="polite"></small>
          </label>
          <label class="field" for="guestbook-signature">
            <span>Signé</span>
            <input id="guestbook-signature" name="signature" maxlength="${GUESTBOOK_SIGNATURE_MAX}" autocomplete="name" required placeholder="Ex. Marie et Paul">
          </label>
          <button class="cta" type="submit" id="guestbook-submit">Déposer mon message</button>
          <p class="err" id="guestbook-error" role="alert" aria-live="assertive"></p>
        </form>
      </div>
    </section>
  `;
}

export function initGuestbook() {
  const status = document.querySelector('#guestbook-status');
  const form = document.querySelector('#guestbook-form');
  const messageInput = document.querySelector('#guestbook-message');
  const signatureInput = document.querySelector('#guestbook-signature');
  const counter = document.querySelector('#guestbook-count');
  const submitButton = document.querySelector('#guestbook-submit');
  const errorElement = document.querySelector('#guestbook-error');
  const token = new URL(window.location.href).searchParams.get('i');
  let hasEntry = false;

  // Message de confirmation en gras qui rebondit, pour montrer que l'envoi a réussi.
  function celebrate(message) {
    status.textContent = message;
    status.hidden = false;
    status.classList.remove('guestbook-sent');
    void status.offsetWidth; // relance l'animation à chaque envoi
    status.classList.add('guestbook-sent');
    status.scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }

  function updateCounter() {
    counter.textContent = `${messageInput.value.length} / ${GUESTBOOK_MESSAGE_MAX}`;
  }

  function showEntry(data) {
    hasEntry = Boolean(data.entry);
    messageInput.value = data.entry?.message ?? '';
    signatureInput.value = data.entry?.signature ?? data.nom_foyer;
    submitButton.textContent = hasEntry ? 'Mettre à jour mon message' : 'Déposer mon message';
    status.textContent = hasEntry
      ? 'Merci, votre message figure dans le livre d’or. Vous pouvez encore le modifier.'
      : '';
    status.hidden = !hasEntry;
    status.classList.remove('guestbook-sent');
    form.hidden = false;
    updateCounter();
  }

  async function load() {
    if (!token || !/^[a-f0-9]{24}$/.test(token)) {
      status.textContent =
        'Le livre d’or est accessible avec le lien personnel reçu dans votre invitation.';
      return;
    }
    if (supabaseConfigError) {
      status.textContent = supabaseConfigError;
      return;
    }

    try {
      const data = await getGuestbookEntry(token);
      if (!data) {
        status.textContent =
          'Cette invitation est introuvable. Utilisez le lien reçu ou contactez les hôtes.';
        return;
      }
      showEntry(data);
    } catch (error) {
      console.error('Impossible de charger le livre d’or.', error);
      status.textContent =
        'Impossible d’ouvrir le livre d’or pour le moment. Vérifiez votre connexion et rechargez la page.';
    }
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    const message = messageInput.value.trim();
    const signature = signatureInput.value.trim();

    if (!message) {
      errorElement.textContent = 'Écrivez votre message avant de l’envoyer.';
      messageInput.focus();
      return;
    }
    if (!signature) {
      errorElement.textContent = 'Indiquez comment signer votre message.';
      signatureInput.focus();
      return;
    }

    errorElement.textContent = '';
    submitButton.disabled = true;
    try {
      showEntry(await submitGuestbookEntry(token, signature, message));
      celebrate('Merci, votre message a bien été ajouté au livre d’or.');
    } catch (error) {
      console.error('Impossible d’enregistrer le message du livre d’or.', error);
      errorElement.textContent =
        'Votre message n’a pas pu être enregistré. Vérifiez votre connexion puis réessayez.';
    } finally {
      submitButton.disabled = false;
    }
  }

  function clearError() {
    errorElement.textContent = '';
  }

  messageInput.addEventListener('input', updateCounter);
  messageInput.addEventListener('input', clearError);
  signatureInput.addEventListener('input', clearError);
  form.addEventListener('submit', handleSubmit);
  load();

  return () => {
    messageInput.removeEventListener('input', updateCounter);
    messageInput.removeEventListener('input', clearError);
    signatureInput.removeEventListener('input', clearError);
    form.removeEventListener('submit', handleSubmit);
  };
}
