import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { event } from '../config.js';

gsap.registerPlugin(ScrollTrigger);

// Étapes du compteur : rencontre, mariage, puis tous les dix ans jusqu'à la fête.
const eventYear = Number(event.date.slice(0, 4));
const milestones = [event.meetingYear, event.weddingYear];
for (let year = event.weddingYear + 10; year < eventYear; year += 10) {
  milestones.push(year);
}
milestones.push(eventYear);
const lastIndex = milestones.length - 1;

// Délai minimal entre deux étapes : un geste, même appuyé, n'avance que d'une.
const STEP_COOLDOWN = 700;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const storyLines = [
  'Deux chemins se sont croisés.',
  'Ils ont bâti, grandi, aimé.',
  'Quarante-cinq ans plus tard, l’histoire continue.',
];

// Une phrase par période : la rencontre, les années de mariage, la fête.
function lineForStep(index) {
  if (index === 0) return 0;
  return index === lastIndex ? 2 : 1;
}

export function createHistoryMarkup() {
  return `
    <section id="histoire" class="stage" aria-labelledby="year">
      <div class="sticky">
        <div class="year" id="year">${milestones[0]}</div>
        <div class="lines" id="lines" aria-live="polite">
          ${storyLines.map((line) => `<p>${line}</p>`).join('')}
        </div>
        <div class="story-dots" id="story-dots" aria-hidden="true">
          ${milestones.map(() => '<span></span>').join('')}
        </div>
        <p class="story-hint" id="story-hint"></p>
        <button class="story-skip" id="story-skip" type="button">Passer l’histoire</button>
      </div>
    </section>
  `;
}

export function initHistory(sceneState) {
  const root = document.documentElement;
  const section = document.querySelector('#histoire');
  const yearElement = document.querySelector('#year');
  const lineElements = Array.from(document.querySelectorAll('#lines p'));
  const dotElements = Array.from(document.querySelectorAll('#story-dots span'));
  const hintElement = document.querySelector('#story-hint');
  const skipStoryButton = document.querySelector('#story-skip');
  const skipIntroLink = document.querySelector('.skip');
  const counter = { value: milestones[0] };

  // Étape -1 = accueil, 0..lastIndex = années, au-delà = défilement libre.
  let position = -1;
  let shownIndex = -1;
  let locked = false;
  let busy = false;
  let lastStep = 0;
  let lastWheel = 0;
  let lastWheelSize = 0;
  let touchY = null;
  let glideTween = null;

  const gateY = () => Math.round(section.getBoundingClientRect().top + window.scrollY);

  function showStep(index, instant) {
    if (index === shownIndex) return;
    shownIndex = index;
    const duration = instant || reducedMotion.matches ? 0 : 1;
    const lineIndex = lineForStep(index);

    gsap.to(counter, {
      value: milestones[index],
      duration: duration * 0.9,
      ease: 'power2.out',
      overwrite: true,
      onUpdate() {
        yearElement.textContent = String(Math.round(counter.value));
      },
    });
    if (!duration) yearElement.textContent = String(milestones[index]);

    lineElements.forEach((line, i) => {
      gsap.to(line, {
        opacity: i === lineIndex ? 1 : 0,
        y: i === lineIndex ? 0 : i < lineIndex ? -14 : 14,
        duration: duration * 0.6,
        overwrite: true,
      });
    });
    dotElements.forEach((dot, i) => {
      dot.classList.toggle('on', i === index);
      dot.classList.toggle('done', i < index);
    });
    gsap.to(sceneState, {
      helixProgress: index / lastIndex,
      spin: (1.4 * index) / lastIndex,
      duration: duration * 0.9,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
    hintElement.textContent =
      index === lastIndex
        ? 'Faites défiler pour découvrir les souvenirs'
        : 'Faites défiler pour continuer';
  }

  // La page glisse elle-même vers sa cible : le défilement natif reste coupé.
  function glide(top, duration, done) {
    const scroll = { y: window.scrollY };
    glideTween?.kill();
    glideTween = gsap.to(scroll, {
      y: top,
      duration: reducedMotion.matches ? 0 : duration,
      ease: 'power2.inOut',
      onUpdate() {
        window.scrollTo(0, scroll.y);
      },
      onComplete() {
        window.scrollTo(0, top);
        done?.();
      },
    });
  }

  function lock() {
    locked = true;
    root.classList.add('story-lock');
  }

  function unlock() {
    locked = false;
    root.classList.remove('story-lock');
  }

  function go(direction) {
    const now = performance.now();
    if (busy || now - lastStep < STEP_COOLDOWN) return;
    const next = position + direction;
    if (next < -1) return;
    lastStep = now;

    if (next === -1) {
      // Retour à l'accueil.
      busy = true;
      position = -1;
      glide(0, 0.9, () => {
        busy = false;
      });
    } else if (next > lastIndex) {
      // Après la dernière année, le défilement redevient normal.
      busy = true;
      position = next;
      glide(gateY() + window.innerHeight * 0.75, 0.85, () => {
        unlock();
        busy = false;
      });
    } else if (position === -1) {
      // De l'accueil à la première année.
      busy = true;
      position = next;
      showStep(next);
      glide(gateY(), 0.9, () => {
        busy = false;
      });
    } else {
      position = next;
      showStep(next);
    }
  }

  function finishStory() {
    glideTween?.kill();
    busy = false;
    position = lastIndex + 1;
    showStep(lastIndex, true);
    unlock();
  }

  // Un mouvement continu (élan du pavé tactile compris) compte pour un seul geste ;
  // une nouvelle impulsion nette pendant l'élan compte comme un nouveau geste.
  function handleWheel(wheelEvent) {
    if (!locked) return;
    wheelEvent.preventDefault();
    const size = Math.abs(wheelEvent.deltaY);
    if (size < 3) return;
    const now = performance.now();
    const fresh =
      now - lastWheel > 200 ||
      (size > lastWheelSize * 2.2 && size > 40 && now - lastStep > 900);
    lastWheel = now;
    lastWheelSize = size;
    if (fresh) go(wheelEvent.deltaY > 0 ? 1 : -1);
  }

  function handleTouchStart(touchEvent) {
    touchY = touchEvent.touches.length === 1 ? touchEvent.touches[0].clientY : null;
  }

  function handleTouchMove(touchEvent) {
    if (locked && touchEvent.cancelable) touchEvent.preventDefault();
  }

  function handleTouchEnd(touchEvent) {
    if (!locked || touchY === null) {
      touchY = null;
      return;
    }
    const distance = touchY - touchEvent.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(distance) > 30) go(distance > 0 ? 1 : -1);
  }

  function handleTouchCancel() {
    touchY = null;
  }

  function handleKeydown(keyEvent) {
    if (!locked || keyEvent.target.closest?.('input, textarea, select')) return;
    if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(keyEvent.key)) {
      keyEvent.preventDefault();
      go(1);
    } else if (['ArrowUp', 'PageUp'].includes(keyEvent.key)) {
      keyEvent.preventDefault();
      go(-1);
    }
  }

  function handleResize() {
    if (locked && !busy) window.scrollTo(0, position < 0 ? 0 : gateY());
  }

  function handleSkipStory() {
    finishStory();
    glide(document.querySelector('#souvenirs').getBoundingClientRect().top + window.scrollY, 0.9);
  }

  // « Passer l'introduction » mène directement à la première année.
  function handleSkipIntro(clickEvent) {
    if (!locked) return;
    clickEvent.preventDefault();
    if (position === -1) go(1);
  }

  const entrance = gsap.fromTo(
    sceneState,
    { gemY: 0, gemScale: 1, helixOpacity: 0 },
    {
      gemY: 1.55,
      gemScale: 0.55,
      helixOpacity: 1,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: '#histoire',
        start: 'top bottom',
        end: 'top top',
        scrub: 0.9,
      },
    },
  );

  showStep(0, true);
  gsap.set(sceneState, { helixProgress: 0, spin: 0 });

  // Le blocage ne s'applique qu'à une visite depuis l'accueil ; un lien vers une
  // section (#rsvp, #livre-or…) ou une page déjà défilée garde le défilement libre.
  const startsAtTop = !window.location.hash && window.scrollY < gateY();
  if (startsAtTop) {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    lock();
  } else {
    finishStory();
  }

  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('touchcancel', handleTouchCancel);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
  skipStoryButton.addEventListener('click', handleSkipStory);
  skipIntroLink?.addEventListener('click', handleSkipIntro);

  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchCancel);
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', handleResize);
    skipStoryButton.removeEventListener('click', handleSkipStory);
    skipIntroLink?.removeEventListener('click', handleSkipIntro);
    glideTween?.kill();
    entrance.scrollTrigger?.kill();
    entrance.kill();
    unlock();
  };
}
