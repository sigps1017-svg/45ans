import './style.css';
import { event, memories } from './config.js';
import { createIntroMarkup, initIntro } from './scenes/intro.js';
import { createHistoryMarkup, initHistory } from './scenes/histoire.js';
import { createSouvenirsMarkup, initSouvenirs } from './scenes/souvenirs.js';
import { createRsvpMarkup } from './rsvp/form.js';
import { initRsvp } from './rsvp/index.js';
import { createGuestbookMarkup, initGuestbook } from './rsvp/livre-or.js';
import { loadMemories } from './lib/souvenirs.js';
import { supabaseConfigError } from './lib/supabase.js';
import { loadActiveMusic } from './lib/musique.js';
import { initMusicPlayer } from './music.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Impossible de démarrer le site : élément #app introuvable.');
}

app.innerHTML = `
  <div class="bg" aria-hidden="true"></div>
  <canvas id="webgl" aria-hidden="true"></canvas>
  <a class="skip" href="#histoire">Passer l’introduction</a>
  <main>
    ${createIntroMarkup()}
    ${createHistoryMarkup(event)}
    ${createSouvenirsMarkup(memories)}
    ${createRsvpMarkup(event)}
    ${createGuestbookMarkup(event)}
    <footer>Avec tout notre amour</footer>
  </main>
  <dialog id="confirm" class="confirm-dialog" aria-labelledby="confirm-title">
    <div class="confirm-card" id="confirm-card"></div>
  </dialog>
`;

// Souvenirs modifiés par les admins (Supabase), sinon ceux de src/config.js.
const MEMORIES_TIMEOUT = 2500;
const memoriesPromise = supabaseConfigError
  ? Promise.resolve(memories)
  : Promise.race([
      loadMemories(memories),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Délai dépassé.')), MEMORIES_TIMEOUT);
      }),
    ]).catch((error) => {
      console.warn('Souvenirs Supabase indisponibles : photos par défaut utilisées.', error);
      return memories;
    });

let resolveSceneReady;
const sceneReady = new Promise((resolve) => {
  resolveSceneReady = resolve;
});
const rsvp = initRsvp({ event, sceneReady });
const cleanups = [rsvp.cleanup, initGuestbook()];

// Musique de fond choisie par les admins ; sans morceau actif, pas de bouton.
if (!supabaseConfigError) {
  loadActiveMusic()
    .then((track) => {
      if (track) cleanups.push(initMusicPlayer(track));
    })
    .catch((error) => {
      console.warn('Musique de fond indisponible.', error);
    });
}

const scenePromise = Promise.all([import('./scenes/gem-scene.js'), memoriesPromise])
  .then(([{ createGemScene }, loadedMemories]) => {
    const scene = createGemScene(document.querySelector('#webgl'));
    rsvp.setScene(scene);
    resolveSceneReady(scene);
    cleanups.push(
      initIntro(scene.state, scene.startHeartCycle),
      initHistory(scene.state, event),
      initSouvenirs(scene, loadedMemories),
    );
    return scene;
  })
  .catch((error) => {
    console.error('La scène 3D n’a pas pu être initialisée.', error);
    document.body.classList.add('scene-failed');
    resolveSceneReady(null);
    return null;
  });

window.addEventListener(
  'pagehide',
  () => {
    cleanups.forEach((cleanup) => cleanup());
    scenePromise.then((scene) => scene?.dispose());
  },
  { once: true },
);
