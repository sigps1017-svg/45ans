// Musique de fond de la page invités, avec un bouton pour couper ou remettre le son.
// Les navigateurs bloquent le son sans geste du visiteur : la lecture démarre au
// premier toucher, clic ou touche, sauf si le visiteur a déjà coupé la musique.

const PREFERENCE_KEY = 'noces-musique';
const TARGET_VOLUME = 0.55;
const FADE_MS = 1800;

function readPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY);
  } catch {
    return null;
  }
}

function writePreference(value) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, value);
  } catch {
    // Préférence non mémorisée (navigation privée) : sans conséquence.
  }
}

export function initMusicPlayer({ url, title }) {
  const audio = new Audio();
  audio.src = url;
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'music-toggle';
  button.innerHTML = `
    <span class="music-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="music-label"></span>
  `;
  const label = button.querySelector('.music-label');
  document.body.append(button);

  let wantsMusic = readPreference() !== 'off';
  let resumeWhenVisible = false;
  let fadeFrame = 0;

  function render() {
    const playing = !audio.paused;
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    const action = playing ? 'Couper la musique' : 'Écouter la musique';
    button.setAttribute('aria-label', `${action} : ${title}`);
    button.title = `${action} · ${title}`;
    label.textContent = playing ? 'Musique' : 'Son coupé';
  }

  function fadeTo(target, onDone) {
    window.cancelAnimationFrame(fadeFrame);
    const from = audio.volume;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / FADE_MS);
      audio.volume = from + (target - from) * progress;
      if (progress < 1) fadeFrame = window.requestAnimationFrame(step);
      else onDone?.();
    };
    fadeFrame = window.requestAnimationFrame(step);
  }

  async function play() {
    try {
      await audio.play();
      fadeTo(TARGET_VOLUME);
    } catch (error) {
      // Lecture refusée (aucun geste encore) ou fichier illisible : on attend le suivant.
      if (error.name !== 'NotAllowedError') {
        console.warn('La musique n’a pas pu être lue.', error);
      }
    }
    render();
  }

  function pause() {
    fadeTo(0, () => {
      audio.pause();
      render();
    });
  }

  function handleFirstGesture(gestureEvent) {
    if (button.contains(gestureEvent.target)) return;
    removeGestureListeners();
    if (wantsMusic && audio.paused) play();
  }

  const gestureEvents = ['pointerdown', 'keydown', 'touchend'];
  function removeGestureListeners() {
    gestureEvents.forEach((type) =>
      window.removeEventListener(type, handleFirstGesture, true),
    );
  }
  gestureEvents.forEach((type) =>
    window.addEventListener(type, handleFirstGesture, true),
  );

  function handleButton() {
    removeGestureListeners();
    if (audio.paused) {
      wantsMusic = true;
      writePreference('on');
      play();
    } else {
      wantsMusic = false;
      writePreference('off');
      pause();
    }
  }

  // Pause quand l'onglet est caché, reprise au retour.
  function handleVisibility() {
    if (document.hidden) {
      resumeWhenVisible = !audio.paused;
      if (resumeWhenVisible) audio.pause();
    } else if (resumeWhenVisible && wantsMusic) {
      play();
    }
    render();
  }

  button.addEventListener('click', handleButton);
  document.addEventListener('visibilitychange', handleVisibility);
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  render();

  return () => {
    removeGestureListeners();
    window.cancelAnimationFrame(fadeFrame);
    button.removeEventListener('click', handleButton);
    document.removeEventListener('visibilitychange', handleVisibility);
    audio.pause();
    audio.removeAttribute('src');
    button.remove();
  };
}
