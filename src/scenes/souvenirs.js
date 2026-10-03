import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HUES = [28, 12, 345, 40, 18, 330];

function seeded(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPhoto(context, size, memory, faceIndex) {
  const random = seeded(memory.year * 10 + faceIndex);
  const border = size * 0.05;
  const hue = HUES[(faceIndex + memory.year) % HUES.length];

  context.fillStyle = '#f6f1e6';
  context.fillRect(0, 0, size, size);
  const background = context.createLinearGradient(
    border,
    border,
    size - border,
    size - border,
  );
  background.addColorStop(0, `hsl(${hue},48%,36%)`);
  background.addColorStop(1, `hsl(${hue + 35},55%,13%)`);
  context.fillStyle = background;
  context.fillRect(border, border, size - border * 2, size - border * 2);

  context.save();
  context.beginPath();
  context.rect(border, border, size - border * 2, size - border * 2);
  context.clip();
  for (let index = 0; index < 9; index += 1) {
    const centerX = border + random() * (size - border * 2);
    const centerY = border + random() * (size - border * 2);
    const radius = size * (0.05 + random() * 0.16);
    const glow = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius,
    );
    glow.addColorStop(0, `rgba(255,240,220,${0.1 + random() * 0.14})`);
    glow.addColorStop(1, 'rgba(255,240,220,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
  }

  const captionBand = context.createLinearGradient(0, size * 0.62, 0, size - border);
  captionBand.addColorStop(0, 'rgba(9,8,14,0)');
  captionBand.addColorStop(1, 'rgba(9,8,14,.7)');
  context.fillStyle = captionBand;
  context.fillRect(
    border,
    size * 0.62,
    size - border * 2,
    size * 0.38 - border,
  );
  context.restore();

  context.strokeStyle = 'rgba(216,184,122,.9)';
  context.lineWidth = size * 0.006;
  context.strokeRect(border * 0.5, border * 0.5, size - border, size - border);
  const centerX = size / 2;
  const centerY = size * 0.4;
  const diamond = size * 0.06;
  context.strokeStyle = 'rgba(250,228,205,.7)';
  context.lineWidth = size * 0.004;
  context.beginPath();
  context.moveTo(centerX, centerY - diamond);
  context.lineTo(centerX + diamond * 0.8, centerY);
  context.lineTo(centerX, centerY + diamond * 1.2);
  context.lineTo(centerX - diamond * 0.8, centerY);
  context.closePath();
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = 'rgba(250,228,205,.75)';
  context.font = `italic ${size * 0.05}px Georgia, serif`;
  context.fillText('Photo à venir', centerX, centerY + diamond * 2.4);
  context.textAlign = 'left';
  context.fillStyle = '#f7dcb0';
  context.font = `300 ${size * 0.12}px Georgia, serif`;
  context.fillText(String(memory.year), border * 1.8, size - border * 2.4);
  context.textAlign = 'right';
  context.fillStyle = 'rgba(246,240,234,.8)';
  context.font = `italic ${size * 0.052}px Georgia, serif`;
  context.fillText(`${faceIndex + 1} / 6`, size - border * 1.8, size - border * 2.6);
}

function createFallbackTexture(THREE, memory, faceIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Impossible de créer le cadre illustré d’un souvenir.');
  }

  drawPhoto(context, 384, memory, faceIndex);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCubePhotoTexture(THREE, image, maxSize) {
  const size = Math.min(maxSize, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Impossible de préparer une texture photo pour un cube.');
  }

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  const cropX = (image.naturalWidth - cropSize) / 2;
  const cropY = (image.naturalHeight - cropSize) / 2;
  context.drawImage(
    image,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    size,
    size,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createViewerPhoto(memory, faceIndex) {
  const photo = memory.photos[faceIndex];
  if (photo) return photo;

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Impossible de créer l’aperçu agrandi du souvenir.');
  }
  drawPhoto(context, 1000, memory, faceIndex);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function createAccessiblePhotoList(memories) {
  return memories
    .flatMap(({ year, caption }) =>
      Array.from(
        { length: 6 },
        (_, index) =>
          `<li>${escapeHtml(year)} — ${escapeHtml(caption)}, photo ${index + 1} sur 6</li>`,
      ),
    )
    .join('');
}

export function createSouvenirsMarkup(memories) {
  const accessiblePhotos = createAccessiblePhotoList(memories);

  return `
    <section id="souvenirs" class="stage" aria-labelledby="souvenirs-title">
      <div class="sticky souv-title">
        <h2 id="souvenirs-title">Quarante-cinq ans<br>de souvenirs</h2>
        <p>Touchez une face pour l’agrandir.<br>Faites glisser un cube pour le tourner.</p>
        <ul class="visually-hidden" id="souvenirs-list" aria-label="Liste des photos souvenirs">
          ${accessiblePhotos}
        </ul>
      </div>
    </section>
    <dialog id="souvenirs-viewer" class="photo-viewer" aria-labelledby="viewer-year">
      <button class="viewer-close" type="button" data-viewer-close aria-label="Fermer la visionneuse">Fermer</button>
      <div class="viewer-content">
        <figure class="viewer-figure">
          <img class="viewer-image" data-viewer-image alt="">
          <figcaption class="viewer-caption">
            <strong id="viewer-year" data-viewer-year></strong>
            <span data-viewer-caption></span>
            <small data-viewer-count aria-live="polite"></small>
          </figcaption>
        </figure>
        <nav class="viewer-navigation" aria-label="Navigation entre les photos">
          <button type="button" data-viewer-previous>Photo précédente</button>
          <button type="button" data-viewer-next>Photo suivante</button>
        </nav>
      </div>
    </dialog>
  `;
}

export function initSouvenirs(sceneApi, memories) {
  const {
    THREE,
    scene,
    state,
    renderer,
    framesGroup,
    addResizeHandler,
    addFrameHandler,
  } = sceneApi;
  // Les années et légendes peuvent venir de Supabase : la liste accessible suit.
  document.querySelector('#souvenirs-list').innerHTML = createAccessiblePhotoList(memories);
  const textureLoader = new THREE.TextureLoader();
  const cubeTextureSize = window.innerWidth < 700 ? 512 : 768;
  const fallbackTextures = new Set();
  const cubes = [];
  const boxGeometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
  const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
  const viewer = document.querySelector('#souvenirs-viewer');
  const viewerFigure = viewer.querySelector('.viewer-figure');
  const viewerImage = viewer.querySelector('[data-viewer-image]');
  const viewerYear = viewer.querySelector('[data-viewer-year]');
  const viewerCaption = viewer.querySelector('[data-viewer-caption]');
  const viewerCount = viewer.querySelector('[data-viewer-count]');
  const closeButton = viewer.querySelector('[data-viewer-close]');
  const previousButton = viewer.querySelector('[data-viewer-previous]');
  const nextButton = viewer.querySelector('[data-viewer-next]');
  let activeCube = null;
  let activeFace = 0;
  let drag = null;
  let viewerOpen = false;
  let closingViewer = false;
  let previousFocus = null;
  let swipeStartX = null;
  let disposed = false;

  memories.forEach((memory, index) => {
    if (!Array.isArray(memory.photos) || memory.photos.length !== 6) {
      throw new Error(`Le souvenir ${memory.year} doit configurer exactement six photos.`);
    }

    const materials = memory.photos.map((photo, faceIndex) => {
      const fallback = createFallbackTexture(THREE, memory, faceIndex);
      fallbackTextures.add(fallback);
      const material = new THREE.MeshBasicMaterial({
        map: fallback,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      });

      if (photo) {
        textureLoader.load(
          photo,
          (sourceTexture) => {
            if (disposed) {
              sourceTexture.dispose();
              return;
            }
            const texture = createCubePhotoTexture(
              THREE,
              sourceTexture.image,
              cubeTextureSize,
            );
            sourceTexture.dispose();
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(
              renderer.capabilities.getMaxAnisotropy(),
              4,
            );
            material.map = texture;
            material.needsUpdate = true;
            fallbackTextures.delete(fallback);
            fallback.dispose();
          },
          undefined,
          () => {
            console.info(
              `Photo facultative introuvable (${photo}); le cadre illustré est conservé.`,
            );
          },
        );
      }

      return material;
    });
    const mesh = new THREE.Mesh(boxGeometry, materials);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xb0832f,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.scale.setScalar(1.004);
    mesh.add(edges);
    framesGroup.add(mesh);
    cubes.push({
      memory,
      mesh,
      materials,
      edgeMaterial,
      index,
      rotationX: 0,
      rotationY: 0,
      velocityX: 0,
      velocityY: 0,
    });
  });

  const resizeCubes = () => {
    const narrow = window.innerWidth / window.innerHeight < 0.8;
    cubes.forEach(({ mesh, index }) => {
      const side = index % 2 ? 1 : -1;
      mesh.position.set(
        side * (narrow ? 0.55 : 1.5),
        ((index % 3) - 1) * 0.3,
        -6 - index * 5,
      );
      mesh.scale.setScalar(narrow ? 0.82 : 1);
    });
  };
  const removeResizeHandler = addResizeHandler(resizeCubes);
  const updateCubes = ({ time, delta, baseZ, qrProgress }) => {
    cubes.forEach((cube) => {
      const worldZ = cube.mesh.position.z + state.framesZ;
      const proximity = THREE.MathUtils.clamp(
        (baseZ - 0.6 - worldZ) / 2.2,
        0,
        1,
      );
      const opacity = state.framesOpacity * (1 - qrProgress) * proximity;
      cube.materials.forEach((material) => {
        material.opacity = opacity;
      });
      cube.edgeMaterial.opacity = opacity * 0.85;
      cube.mesh.visible = opacity > 0.001;

      if (!drag || drag.cube !== cube) {
        const decay = Math.pow(0.94, delta * 60);
        cube.velocityX *= decay;
        cube.velocityY *= decay;
        cube.rotationX += cube.velocityX;
        cube.rotationY += cube.velocityY;
      }
      cube.mesh.rotation.x =
        Math.sin(state.framesZ * 0.18 + cube.index * 1.7) * 0.55 +
        cube.rotationX;
      cube.mesh.rotation.y =
        state.framesZ * 0.42 +
        time * 0.12 +
        cube.index * 0.9 +
        cube.rotationY;
    });
  };
  const removeFrameHandler = addFrameHandler(updateCubes);

  function canInteract() {
    return (
      !viewerOpen &&
      !document.querySelector('#confirm')?.open &&
      state.framesOpacity > 0.3 &&
      state.qr < 0.01
    );
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hitCube(clientX, clientY) {
    pointer.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, sceneApi.camera);
    const visibleMeshes = cubes
      .filter(
        (cube) =>
          cube.mesh.visible && cube.materials[0].opacity > 0.5,
      )
      .map((cube) => cube.mesh);
    const intersection = raycaster.intersectObjects(visibleMeshes, false)[0];
    if (!intersection || intersection.face === null) return null;
    return {
      cube: cubes.find((cube) => cube.mesh === intersection.object),
      face: intersection.face.materialIndex,
    };
  }

  function startDrag(clientX, clientY) {
    if (!canInteract()) return false;
    const hit = hitCube(clientX, clientY);
    if (!hit) return false;
    drag = {
      ...hit,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      startedAt: performance.now(),
      moved: false,
    };
    hit.cube.velocityX = 0;
    hit.cube.velocityY = 0;
    return true;
  }

  function moveDrag(clientX, clientY) {
    if (!drag) return;
    const deltaX = clientX - drag.lastX;
    const deltaY = clientY - drag.lastY;
    if (Math.hypot(clientX - drag.startX, clientY - drag.startY) > 8) {
      drag.moved = true;
    }
    drag.cube.rotationY += deltaX * 0.011;
    drag.cube.rotationX += deltaY * 0.011;
    drag.cube.velocityY = deltaX * 0.011;
    drag.cube.velocityX = deltaY * 0.011;
    drag.lastX = clientX;
    drag.lastY = clientY;
  }

  function renderViewer() {
    const memory = activeCube.memory;
    viewerImage.src = createViewerPhoto(memory, activeFace);
    viewerImage.alt = `${memory.caption}, ${memory.year}, photo ${activeFace + 1} sur 6`;
    viewerYear.textContent = String(memory.year);
    viewerCaption.textContent = memory.caption;
    viewerCount.textContent = `Photo ${activeFace + 1} sur 6`;
  }

  function openViewer(cube, face) {
    activeCube = cube;
    activeFace = face;
    previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    renderViewer();
    viewer.showModal();
    viewerOpen = true;
    document.body.classList.add('locked');
    gsap.fromTo(
      viewerFigure,
      { opacity: 0, scale: 0.8, y: 24 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)' },
    );
    gsap.fromTo(closeButton, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.2 });
    closeButton.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!viewerOpen || closingViewer) return;
    closingViewer = true;
    gsap.killTweensOf(viewerFigure);
    gsap.killTweensOf(closeButton);
    gsap.to(viewerFigure, {
      opacity: 0,
      scale: 0.9,
      duration: 0.25,
      onComplete() {
        if (viewer.open) viewer.close();
        viewerOpen = false;
        closingViewer = false;
        document.body.classList.remove('locked');
        if (previousFocus?.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      },
    });
  }

  function stepViewer(direction) {
    if (!viewerOpen || !activeCube) return;
    gsap.killTweensOf(viewerImage);
    gsap.to(viewerImage, {
      opacity: 0,
      x: -direction * 30,
      duration: 0.18,
      onComplete() {
        activeFace = (activeFace + direction + 6) % 6;
        renderViewer();
        gsap.fromTo(
          viewerImage,
          { opacity: 0, x: direction * 30 },
          { opacity: 1, x: 0, duration: 0.28, ease: 'power2.out' },
        );
      },
    });
  }

  function endDrag() {
    if (!drag) return;
    const tapped = !drag.moved && performance.now() - drag.startedAt < 500;
    const { cube, face } = drag;
    drag = null;
    if (tapped) openViewer(cube, face);
  }

  function isInteractiveTarget(target) {
    return (
      target instanceof Element &&
      Boolean(target.closest('button, a, input, dialog'))
    );
  }

  function onPointerDown(event) {
    if (!event.isPrimary || event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }
    if (startDrag(event.clientX, event.clientY)) event.preventDefault();
  }

  function onPointerMove(event) {
    if (drag) {
      moveDrag(event.clientX, event.clientY);
      if (event.cancelable) event.preventDefault();
      if (event.pointerType === 'mouse') document.body.style.cursor = 'grabbing';
      return;
    }
    if (event.pointerType === 'mouse') {
      document.body.style.cursor =
        canInteract() && hitCube(event.clientX, event.clientY) ? 'grab' : '';
    }
  }

  function onPointerUp() {
    endDrag();
    document.body.style.cursor = '';
  }

  function onViewerCancel(event) {
    event.preventDefault();
    closeViewer();
  }

  function onViewerClick(event) {
    if (event.target === viewer) closeViewer();
  }

  function onViewerKeyDown(event) {
    if (!viewerOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepViewer(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepViewer(1);
    }
  }

  function onImagePointerDown(event) {
    swipeStartX = event.clientX;
  }

  function onImagePointerUp(event) {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(distance) > 45) stepViewer(distance < 0 ? 1 : -1);
  }

  const onPreviousClick = () => stepViewer(-1);
  const onNextClick = () => stepViewer(1);
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
        gemY: 3.6,
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

  closeButton.addEventListener('click', closeViewer);
  previousButton.addEventListener('click', onPreviousClick);
  nextButton.addEventListener('click', onNextClick);
  viewer.addEventListener('cancel', onViewerCancel);
  viewer.addEventListener('click', onViewerClick);
  viewerImage.addEventListener('pointerdown', onImagePointerDown);
  viewerImage.addEventListener('pointerup', onImagePointerUp);
  document.addEventListener('keydown', onViewerKeyDown);
  window.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return () => {
    disposed = true;
    context.revert();
    removeResizeHandler();
    removeFrameHandler();
    closeButton.removeEventListener('click', closeViewer);
    previousButton.removeEventListener('click', onPreviousClick);
    nextButton.removeEventListener('click', onNextClick);
    viewer.removeEventListener('cancel', onViewerCancel);
    viewer.removeEventListener('click', onViewerClick);
    viewerImage.removeEventListener('pointerdown', onImagePointerDown);
    viewerImage.removeEventListener('pointerup', onImagePointerUp);
    document.removeEventListener('keydown', onViewerKeyDown);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    gsap.killTweensOf(viewerFigure);
    gsap.killTweensOf(viewerImage);
    gsap.killTweensOf(closeButton);
    if (viewer.open) viewer.close();
    document.body.classList.remove('locked');
    document.body.style.cursor = '';

    cubes.forEach((cube) => {
      framesGroup.remove(cube.mesh);
      cube.materials.forEach((material) => {
        if (material.map && !fallbackTextures.has(material.map)) {
          material.map.dispose();
        }
        material.dispose();
      });
      cube.edgeMaterial.dispose();
    });
    boxGeometry.dispose();
    edgeGeometry.dispose();
    fallbackTextures.forEach((texture) => texture.dispose());
    fallbackTextures.clear();
  };
}
