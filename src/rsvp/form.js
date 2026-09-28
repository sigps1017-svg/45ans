import { drinks } from '../config.js';

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

export function createRsvpMarkup(event) {
  return `
    <section id="invitation" aria-labelledby="invitation-title">
      <div class="panel">
        <h2 id="invitation-title">Célébrons leurs noces de saphir</h2>
        <p class="lede">Vous êtes invités à une soirée en leur honneur.</p>
        <dl class="details">
          <div><dt>Quand</dt><dd>${escapeHtml(event.dateLabel)}<small>Cocktail à ${escapeHtml(event.cocktailTime)}, souper à ${escapeHtml(event.dinnerTime)}</small></dd></div>
          <div><dt>Où</dt><dd>${escapeHtml(event.venue)}<small>${escapeHtml(event.address)}</small></dd></div>
          <div><dt>Tenue</dt><dd>${escapeHtml(event.dressCode)}</dd></div>
        </dl>
      </div>
    </section>

    <section id="rsvp" aria-labelledby="rsvp-title">
      <div class="panel">
        <h2 id="rsvp-title">Votre réponse</h2>
        <p class="lede">Merci de répondre avant le ${escapeHtml(event.rsvpDeadline)}.</p>
        <p class="again" id="again" hidden>
          Votre réponse est enregistrée.
          <button type="button" id="reopen-confirmation">Voir ma confirmation</button>
        </p>
        <form id="rsvp-form" novalidate>
          <label class="field" for="household-name">
            <span>Nom du foyer</span>
            <input id="household-name" name="name" autocomplete="name" placeholder="Ex. Famille LeBlanc" required>
          </label>
          <fieldset class="presence">
            <legend>Votre présence</legend>
            <button type="button" class="pres" data-presence="oui" aria-pressed="true">
              <strong>Avec joie</strong>Je serai là
            </button>
            <button type="button" class="pres" data-presence="non" aria-pressed="false">
              <strong>Hélas</strong>Je ne pourrai pas venir
            </button>
          </fieldset>
          <div id="yes-block">
            <div class="field">
              <span>Nombre de personnes</span>
              <div class="stepper">
                <button type="button" id="minus" aria-label="Retirer une personne">−</button>
                <output id="count" aria-live="polite">2</output>
                <button type="button" id="plus" aria-label="Ajouter une personne">+</button>
              </div>
            </div>
            <div id="guests"></div>
            <label class="field notes-field" for="food-notes">
              <span>Allergies alimentaires (facultatif)</span>
              <input id="food-notes" name="notes" placeholder="Ex. noix, fruits de mer">
            </label>
          </div>
          <button class="cta" type="submit" id="submit-rsvp">Confirmer ma présence</button>
          <p class="err" id="rsvp-error" role="alert" aria-live="assertive"></p>
        </form>
        <p class="storage-warning" id="storage-warning" role="status" hidden></p>
      </div>
    </section>
  `;
}

export function initRsvpForm({ onSubmit }) {
  const form = document.querySelector('#rsvp-form');
  const nameInput = document.querySelector('#household-name');
  const notesInput = document.querySelector('#food-notes');
  const yesBlock = document.querySelector('#yes-block');
  const guestsContainer = document.querySelector('#guests');
  const countOutput = document.querySelector('#count');
  const errorElement = document.querySelector('#rsvp-error');
  const submitButton = document.querySelector('#submit-rsvp');
  const presenceButtons = Array.from(document.querySelectorAll('[data-presence]'));
  const minusButton = document.querySelector('#minus');
  const plusButton = document.querySelector('#plus');
  const listeners = [];
  let presence = 'oui';
  let count = 2;
  let guests = [];

  function listen(element, type, handler) {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }

  function renderGuests() {
    while (guests.length < count) guests.push({ name: '', drink: '' });
    guests.length = count;
    guestsContainer.replaceChildren();

    guests.forEach((guest, index) => {
      const section = document.createElement('div');
      section.className = 'guest';

      const nameLabel = document.createElement('label');
      nameLabel.className = 'guest-name';
      const nameCaption = document.createElement('span');
      nameCaption.textContent = `Prénom de la personne ${index + 1}`;
      const nameField = document.createElement('input');
      nameField.autocomplete = 'given-name';
      nameField.value = guest.name;
      nameField.setAttribute('aria-label', nameCaption.textContent);
      nameLabel.append(nameCaption, nameField);
      listen(nameField, 'input', () => {
        guest.name = nameField.value;
      });

      const chips = document.createElement('div');
      chips.className = 'chips';
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', `Boisson de la personne ${index + 1}`);

      drinks.forEach((drink) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.dataset.drink = '';
        button.textContent = drink;
        button.setAttribute('aria-pressed', String(guest.drink === drink));
        listen(button, 'click', () => {
          guest.drink = drink;
          chips.querySelectorAll('[data-drink]').forEach((chip) => {
            chip.setAttribute('aria-pressed', String(chip === button));
          });
          errorElement.textContent = '';
        });
        chips.append(button);
      });

      section.append(nameLabel, chips);
      guestsContainer.append(section);
    });

    countOutput.value = String(count);
    minusButton.disabled = count <= 1;
    plusButton.disabled = count >= 8;
  }

  listen(minusButton, 'click', () => {
    if (count > 1) {
      count -= 1;
      renderGuests();
    }
  });
  listen(plusButton, 'click', () => {
    if (count < 8) {
      count += 1;
      renderGuests();
    }
  });

  presenceButtons.forEach((button) => {
    listen(button, 'click', () => {
      presence = button.dataset.presence;
      presenceButtons.forEach((choice) => {
        choice.setAttribute('aria-pressed', String(choice === button));
      });
      yesBlock.hidden = presence !== 'oui';
      submitButton.textContent =
        presence === 'oui' ? 'Confirmer ma présence' : 'Envoyer ma réponse';
      errorElement.textContent = '';
    });
  });

  listen(nameInput, 'input', () => {
    errorElement.textContent = '';
  });

  listen(form, 'submit', (submitEvent) => {
    submitEvent.preventDefault();
    const name = nameInput.value.trim();

    if (!name) {
      errorElement.textContent = 'Indiquez le nom de votre foyer pour continuer.';
      nameInput.focus();
      return;
    }

    if (presence === 'oui') {
      const missingDrink = guests.findIndex((guest) => !guest.drink);
      if (missingDrink !== -1) {
        errorElement.textContent = `Choisissez une boisson pour la personne ${missingDrink + 1}.`;
        return;
      }
    }

    errorElement.textContent = '';
    onSubmit({
      name,
      presence,
      notes: notesInput.value.trim(),
      guests:
        presence === 'oui'
          ? guests.map((guest, index) => ({
              name: guest.name.trim() || `Personne ${index + 1}`,
              drink: guest.drink,
            }))
          : [],
    });
  });

  renderGuests();

  return {
    fill(data) {
      nameInput.value = data.name;
      notesInput.value = data.notes ?? '';
      presence = data.presence;
      presenceButtons.forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.presence === presence),
        );
      });
      yesBlock.hidden = presence !== 'oui';
      submitButton.textContent =
        presence === 'oui' ? 'Confirmer ma présence' : 'Envoyer ma réponse';
      if (presence === 'oui' && data.guests?.length) {
        guests = data.guests.map((guest) => ({
          name: guest.name ?? '',
          drink: guest.drink ?? '',
        }));
        count = guests.length;
        renderGuests();
      }
    },
    showError(message) {
      errorElement.textContent = message;
    },
    cleanup() {
      listeners.forEach((removeListener) => removeListener());
    },
  };
}
