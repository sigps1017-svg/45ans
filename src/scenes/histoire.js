import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { event, memories } from '../config.js';

gsap.registerPlugin(ScrollTrigger);

const storyLines = [
  'Deux chemins se sont croisés.',
  'Ils ont bâti, grandi, aimé.',
  'Quarante-cinq ans plus tard, l’histoire continue.',
];

export function createHistoryMarkup() {
  return `
    <section id="histoire" class="stage" aria-labelledby="year">
      <div class="sticky">
        <div class="year" id="year">${memories[0].year}</div>
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
  const firstYear = memories[0].year;
  const lastYear = Number(event.date.slice(0, 4));

  gsap.set(lineElements[0], { opacity: 1 });

  const context = gsap.context(() => {
    gsap.fromTo(
      sceneState,
      { gemY: 0.75, gemScale: 1, helixOpacity: 0 },
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
          onUpdate(self) {
            const progress = self.progress;
            const lineIndex = Math.min(
              lineElements.length - 1,
              Math.floor(progress * lineElements.length),
            );

            yearElement.textContent = String(
              Math.round(firstYear + (lastYear - firstYear) * progress),
            );
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
