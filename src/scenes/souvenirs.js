import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function createFallbackTexture(THREE, year, caption) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 660;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Impossible de créer la texture de remplacement des photos.');
  }

  const frameGradient = context.createLinearGradient(0, 0, 512, 660);
  frameGradient.addColorStop(0, '#f0d9a6');
  frameGradient.addColorStop(0.5, '#b8924e');
  frameGradient.addColorStop(1, '#f0d9a6');
  context.fillStyle = frameGradient;
  context.fillRect(0, 0, 512, 660);
  context.fillStyle = '#f6f1e6';
  context.fillRect(14, 14, 484, 632);

  const photoGradient = context.createLinearGradient(0, 40, 0, 500);
  photoGradient.addColorStop(0, '#27408f');
  photoGradient.addColorStop(1, '#0c1636');
  context.fillStyle = photoGradient;
  context.fillRect(40, 40, 432, 440);

  const glow = context.createRadialGradient(256, 230, 10, 256, 230, 220);
  glow.addColorStop(0, 'rgba(188,211,255,.35)');
  glow.addColorStop(1, 'rgba(188,211,255,0)');
  context.fillStyle = glow;
  context.fillRect(40, 40, 432, 440);

  context.strokeStyle = 'rgba(188,211,255,.6)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(256, 210);
  context.lineTo(286, 240);
  context.lineTo(256, 280);
  context.lineTo(226, 240);
  context.closePath();
  context.stroke();

  context.fillStyle = 'rgba(188,211,255,.75)';
  context.textAlign = 'center';
  context.font = 'italic 26px Georgia, serif';
  context.fillText('Photo à venir', 256, 330);
  context.fillStyle = '#16224d';
  context.font = '300 78px Georgia, serif';
  context.fillText(String(year), 256, 572);
  context.fillStyle = '#8a6a32';
  context.font = 'italic 30px Georgia, serif';
  context.fillText(caption, 256, 618, 440);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createSouvenirsMarkup(memories) {
  const accessibleMemories = memories
    .map(({ year, caption }) => `<li>${year} — ${caption}</li>`)
    .join('');

  return `
    <section id="souvenirs" class="stage" aria-labelledby="souvenirs-title">
      <div class="sticky souv-title">
        <h2 id="souvenirs-title">Quarante-cinq ans<br>de souvenirs</h2>
        <p>Les photos défileront ici au fil des années.</p>
        <ul class="visually-hidden" aria-label="Liste des souvenirs">
          ${accessibleMemories}
        </ul>
      </div>
    </section>
  `;
}

export function initSouvenirs(sceneApi, memories) {
  const { THREE, scene, state, renderer, framesGroup, memoryFrames, addResizeHandler } =
    sceneApi;
  const textureLoader = new THREE.TextureLoader();
  const fallbackTextures = [];
  let disposed = false;

  const resizeFrames = () => {
    const narrow = window.innerWidth / window.innerHeight < 0.8;

    memoryFrames.forEach(({ mesh }, index) => {
      const side = index % 2 ? 1 : -1;
      mesh.position.x = side * (narrow ? 0.62 : 1.55);
      mesh.position.y = ((index % 3) - 1) * 0.25;
      mesh.rotation.y = -side * 0.28;
      mesh.scale.setScalar(narrow ? 0.82 : 1);
    });
  };
  const removeResizeHandler = addResizeHandler(resizeFrames);

  memories.forEach(({ year, caption, photo }, index) => {
    const fallback = createFallbackTexture(THREE, year, caption);
    fallbackTextures.push(fallback);

    const material = new THREE.MeshBasicMaterial({
      map: fallback,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.06), material);
    mesh.position.z = -6 - index * 5;
    framesGroup.add(mesh);
    memoryFrames.push({ mesh, material });

    textureLoader.load(
      photo,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
        material.map = texture;
        material.needsUpdate = true;
        fallback.dispose();
      },
      undefined,
      () => {
        if (!disposed) {
          console.info(
            `Photo facultative introuvable (${photo}); le cadre illustré est conservé.`,
          );
        }
      },
    );
  });
  resizeFrames();

  const context = gsap.context(() => {
    gsap.fromTo(
      state,
      {
        gemY: 1.55,
        gemScale: 0.55,
        helixOpacity: 1,
        framesOpacity: 0,
        spin: 1.4,
      },
      {
        gemY: 2.3,
        gemScale: 0.3,
        helixOpacity: 0,
        framesOpacity: 1,
        spin: 0.3,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: '#souvenirs',
          start: 'top bottom',
          end: 'top top',
          scrub: 0.9,
        },
      },
    );

    gsap.fromTo(
      state,
      { framesZ: 0 },
      {
        framesZ: 33,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: '#souvenirs',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
        },
      },
    );
  });

  return () => {
    disposed = true;
    context.revert();
    removeResizeHandler();
    memoryFrames.forEach(({ mesh, material }) => {
      framesGroup.remove(mesh);
      mesh.geometry.dispose();
      material.map?.dispose();
      material.dispose();
    });
    fallbackTextures.forEach((texture) => texture.dispose());
    memoryFrames.length = 0;
  };
}
