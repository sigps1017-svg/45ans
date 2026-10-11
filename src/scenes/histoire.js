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

// Durée de la montée entre deux étapes et pause sur chacune quand on défile vite.
const STEP_DURATION = 0.6;
const STEP_PAUSE = 0.25;

const storyLines = [
  'Deux chemins se sont croisés.',
  'Ils ont bâti, grandi, aimé.',
  'Quarante-cinq ans plus tard, l’histoire continue.',
];

export function createHistoryMarkup() {
  return `
    <section id="histoire" class="stage" aria-labelledby="year">
      <div class="sticky">
        <div class="year" id="year">${milestones[0]}</div>
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
  const counter = { value: milestones[0] };
  let shownIndex = 0;
  let targetIndex = 0;
  let stepTween = null;

  // Une phrase par période : la rencontre, les années de mariage, la fête.
  function showLine(index) {
    const lineIndex = index === 0 ? 0 : index === milestones.length - 1 ? 2 : 1;
    lineElements.forEach((line, i) => {
      gsap.to(line, {
        opacity: i === lineIndex ? 1 : 0,
        y: i === lineIndex ? 0 : i < lineIndex ? -14 : 14,
        duration: 0.35,
        overwrite: true,
      });
    });
  }

  // Le compteur monte d'étape en étape, sans en sauter, même si on défile vite.
  function stepTowardTarget() {
    if (stepTween || shownIndex === targetIndex) return;
    const nextIndex = shownIndex + Math.sign(targetIndex - shownIndex);
    stepTween = gsap.to(counter, {
      value: milestones[nextIndex],
      duration: STEP_DURATION,
      ease: 'power2.out',
      onUpdate() {
        yearElement.textContent = String(Math.round(counter.value));
      },
      onComplete() {
        shownIndex = nextIndex;
        showLine(shownIndex);
        const pause = shownIndex === targetIndex ? 0 : STEP_PAUSE;
        stepTween = gsap.delayedCall(pause, () => {
          stepTween = null;
          stepTowardTarget();
        });
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
          onUpdate(self) {
            targetIndex = Math.min(
              milestones.length - 1,
              Math.floor(self.progress * milestones.length),
            );
            stepTowardTarget();
          },
        },
      },
    );
  });

  return () => {
    stepTween?.kill();
    context.revert();
  };
}
