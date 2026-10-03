import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { event, memories } from '../config.js';

gsap.registerPlugin(ScrollTrigger);

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

export function createIntroMarkup() {
  const firstYear = memories[0].year;
  const eventYear = Number(event.date.slice(0, 4));
  const names = event.hosts
    .map((host) => `<strong>${escapeHtml(host)}</strong>`)
    .join(' <span class="et">et</span> ');

  return `
    <section id="hero" aria-labelledby="t1">
      <h1 class="title split" id="t1">${event.anniversaryYears} ans</h1>
      <p class="title-sub split" id="t2">d’amour</p>
      <p class="dates">${firstYear} – ${eventYear}</p>
      <p class="names">${names}</p>
      <div class="hint">Faites défiler<span aria-hidden="true"></span></div>
    </section>
  `;
}

function splitText(element) {
  const characters = [];
  const words = element.textContent.split(' ');
  element.replaceChildren();

  words.forEach((word, wordIndex) => {
    const wordElement = document.createElement('span');
    wordElement.className = 'word';

    Array.from(word).forEach((character) => {
      const characterElement = document.createElement('span');
      characterElement.className = 'char';
      characterElement.textContent = character;
      wordElement.append(characterElement);
      characters.push(characterElement);
    });

    element.append(wordElement);
    if (wordIndex < words.length - 1) element.append(' ');
  });

  return characters;
}

export function initIntro(sceneState, startHeartCycle) {
  const firstTitle = document.querySelector('#t1');
  const secondTitle = document.querySelector('#t2');
  const firstCharacters = splitText(firstTitle);
  const secondCharacters = splitText(secondTitle);
  const reduce = reducedMotion.matches;
  const duration = reduce ? 0.6 : 1;

  // Pendant que le texte d'accueil monte et sort de l'écran, le bijou et ses
  // étoiles descendent au centre ; la marge sous #hero les y laisse un moment seuls.
  const centerGem = gsap.fromTo(
    sceneState,
    { gemY: 0.75 },
    {
      gemY: 0,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: () => `+=${window.innerHeight * 0.7}`,
        scrub: 0.9,
        invalidateOnRefresh: true,
      },
    },
  );

  const timeline = gsap.timeline();
  timeline
    .to(sceneState, {
      introProgress: 1,
      duration: reduce ? 0.8 : 3.4,
      ease: 'power2.inOut',
    })
    .to(
      sceneState,
      {
        gemReveal: 1,
        duration: 1.8 * duration,
        ease: 'back.out(1.4)',
      },
      reduce ? 0.4 : 2.3,
    )
    .from(
      firstCharacters,
      {
        yPercent: 115,
        rotateX: -80,
        opacity: 0,
        stagger: reduce ? 0 : 0.06,
        duration: 1.2 * duration,
        ease: 'power4.out',
      },
      reduce ? 0 : 1.9,
    )
    .from(
      secondCharacters,
      {
        yPercent: 100,
        opacity: 0,
        stagger: reduce ? 0 : 0.035,
        duration: duration,
        ease: 'power3.out',
      },
      reduce ? 0 : 2.4,
    )
    .to('.dates', { opacity: 1, duration: reduce ? 0.2 : 1 }, reduce ? 0 : 2.6)
    .to('.names', { opacity: 1, duration: reduce ? 0.2 : 1 }, reduce ? 0 : 2.9)
    .to('.hint', { opacity: 1, duration: reduce ? 0.2 : 1 }, reduce ? 0 : 3.3)
    .add(startHeartCycle);

  return () => {
    timeline.kill();
    centerGem.scrollTrigger?.kill();
    centerGem.kill();
  };
}
