import './style.css';
import { event, memories } from './config.js';
import { createIntroMarkup, initIntro } from './scenes/intro.js';
import { createHistoryMarkup, initHistory } from './scenes/histoire.js';
import { createSouvenirsMarkup, initSouvenirs } from './scenes/souvenirs.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Impossible de démarrer le site : élément #app introuvable.');
}

app.innerHTML = `
  <canvas id="webgl" aria-hidden="true"></canvas>
  <a class="skip" href="#histoire">Passer l’introduction</a>
  <main>
    ${createIntroMarkup()}
    ${createHistoryMarkup(event)}
    ${createSouvenirsMarkup(memories)}
    <footer>Avec tout notre amour</footer>
  </main>
`;

void import('./scenes/sapphire-scene.js')
  .then(({ createSapphireScene }) => {
    const scene = createSapphireScene(document.querySelector('#webgl'));
    const cleanups = [
      initIntro(scene.state),
      initHistory(scene.state, event),
      initSouvenirs(scene, memories),
    ];

    window.addEventListener(
      'pagehide',
      () => {
        cleanups.forEach((cleanup) => cleanup());
        scene.dispose();
      },
      { once: true },
    );
  })
  .catch((error) => {
    console.error('La scène 3D n’a pas pu être initialisée.', error);
    document.body.classList.add('scene-failed');
  });
