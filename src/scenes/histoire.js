import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { event } from '../config.js';

gsap.registerPlugin(ScrollTrigger);

// Hauteur de défilement par année : environ un cran de molette ou un petit
// glissement, pour que chaque année de 1981 à 2026 s'affiche.
const SCROLL_PER_YEAR_SVH = 12;
const firstYear = event.weddingYear;
const lastYear = Number(event.date.slice(0, 4));
const yearCount = lastYear - firstYear;

const storyLines = [
  'Deux chemins se sont croisés.',
  'Ils ont bâti, grandi, aimé.',
  'Quarante-cinq ans plus tard, l’histoire continue.',
];

export function createHistoryMarkup() {
  return `
    <section id="histoire" class="stage" aria-labelledby="year" style="height: calc(100svh + ${yearCount * SCROLL_PER_YEAR_SVH}svh)">
      <div class="sticky">
        <div class="year" id="year">${firstYear}</div>
        <div class="lines" id="lines">
          ${storyLines.map((line) => `<p>${line}</p>`).join('')}
        </div>
      </div>
    </section>
  `;
}

export function initHistory(sceneState) {
  const yearElement = document.querySelector('#year');
  const lineElements = Array.from(document.querySelectorAll('#lines p'));
  // Le compteur passe par chaque année, même quand on défile vite.
  const counter = { value: firstYear };
  let targetYear = firstYear;

  function showYear(year) {
    if (year === targetYear) return;
    const steps = Math.abs(year - targetYear);
    targetYear = year;
    gsap.to(counter, {
      value: year,
      duration: Math.min(0.8, steps * 0.06),
      ease: 'none',
      overwrite: true,
      onUpdate() {
        yearElement.textContent = String(Math.round(counter.value));
      },
    });
  }

  gsap.set(lineElements[0], { opacity: 1 });

  const context = gsap.context(() => {
    gsap.fromTo(
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

    gsap.fromTo(
      sceneState,
      { helixProgress: 0, spin: 0 },
      {
        helixProgress: 1,
        spin: 1.4,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: '#histoire',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
          // Le défilement se pose toujours sur une année.
          snap: {
            snapTo: 1 / yearCount,
            duration: { min: 0.15, max: 0.35 },
            delay: 0.08,
            ease: 'power1.inOut',
          },
          onUpdate(self) {
            const progress = self.progress;
            const lineIndex = Math.min(
              lineElements.length - 1,
              Math.floor(progress * lineElements.length),
            );

            showYear(Math.round(firstYear + yearCount * progress));
            lineElements.forEach((line, index) => {
              gsap.set(line, {
                opacity: index === lineIndex ? 1 : 0,
                y: index === lineIndex ? 0 : index < lineIndex ? -14 : 14,
              });
            });
          },
        },
      },
    );
  });

  return () => context.revert();
}
