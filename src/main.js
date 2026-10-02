import './style.css';
import { event, memories } from './config.js';
import { createIntroMarkup, initIntro } from './scenes/intro.js';
import { createHistoryMarkup, initHistory } from './scenes/histoire.js';
import { createSouvenirsMarkup, initSouvenirs } from './scenes/souvenirs.js';
import { createRsvpMarkup } from './rsvp/form.js';
import { initRsvp } from './rsvp/index.js';

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
    <footer>Avec tout notre amour</footer>
  </main>
  <dialog id="confirm" class="confirm-dialog" aria-labelledby="confirm-title">
    <div class="confirm-card" id="confirm-card"></div>
  </dialog>
`;

let resolveSceneReady;
const sceneReady = new Promise((resolve) => {
  resolveSceneReady = resolve;
});
const rsvp = initRsvp({ event, sceneReady });
const cleanups = [rsvp.cleanup];

const scenePromise = import('./scenes/gem-scene.js')
  .then(({ createGemScene }) => {
    const scene = createGemScene(document.querySelector('#webgl'));
    rsvp.setScene(scene);
    resolveSceneReady(scene);
    cleanups.push(
      initIntro(scene.state, scene.startHeartCycle),
      initHistory(scene.state, event),
      initSouvenirs(scene, memories),
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
