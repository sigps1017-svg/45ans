import * as THREE from 'three';

function randomSpherePoint(minRadius, radiusRange) {
  const radius = minRadius + Math.random() * radiusRange;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  ];
}

export function createSapphireScene(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Impossible de démarrer la scène : canvas #webgl introuvable.');
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x070d24, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070d24, 9, 34);
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  let baseZ = 7;

  const state = {
    introProgress: 0,
    gemY: 0.75,
    gemScale: 1,
    spin: 0,
    helixProgress: 0,
    helixOpacity: 0,
    framesZ: 0,
    framesOpacity: 0,
    qr: 0,
  };

  scene.add(new THREE.AmbientLight(0x6f86c9, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  const pointLights = [
    new THREE.PointLight(0x7fb2ff, 2.2, 12),
    new THREE.PointLight(0xffffff, 1.6, 12),
    new THREE.PointLight(0xb07cff, 1.8, 12),
  ];
  pointLights.forEach((light) => scene.add(light));

  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  const starCount = isSmall ? 900 : 1600;
  const starPositions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const position = randomSpherePoint(14, 18);
    starPositions.set(
      [position[0], position[1], position[2] - 6],
      index * 3,
    );
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xbcd3ff,
      size: 0.06,
      transparent: true,
      opacity: 0.8,
      fog: false,
    }),
  );
  scene.add(stars);

  const gemGroup = new THREE.Group();
  scene.add(gemGroup);
  const gemProfile = [
    new THREE.Vector2(0.0001, -1.15),
    new THREE.Vector2(1, 0.02),
    new THREE.Vector2(1, 0.12),
    new THREE.Vector2(0.58, 0.55),
    new THREE.Vector2(0.0001, 0.55),
  ];
  const gemGeometry = new THREE.LatheGeometry(gemProfile, 8);
  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1d47d8,
    emissive: 0x0a1f6a,
    emissiveIntensity: 0.7,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const gem = new THREE.Mesh(gemGeometry, gemMaterial);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xbcd3ff,
    transparent: true,
    opacity: 0,
  });
  const edgeGeometry = new THREE.EdgesGeometry(gemGeometry, 1);
  gem.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
  gemGroup.add(gem);

  const particleCount = isSmall ? 2600 : 4200;
  const targetPositions = new Float32Array(particleCount * 3);
  const startPositions = new Float32Array(particleCount * 3);
  const qrPositions = new Float32Array(particleCount * 3);
  const randomValues = new Float32Array(particleCount);
  const triangleGeometry = gemGeometry.toNonIndexed();
  const trianglePositions = triangleGeometry.attributes.position;
  const triangleCount = trianglePositions.count / 3;
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  for (let index = 0; index < particleCount; index += 1) {
    const triangle = Math.floor(Math.random() * triangleCount) * 3;
    const [a, b, c] = vertices;
    a.fromBufferAttribute(trianglePositions, triangle);
    b.fromBufferAttribute(trianglePositions, triangle + 1);
    c.fromBufferAttribute(trianglePositions, triangle + 2);

    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }

    const point = a
      .clone()
      .add(b.clone().sub(a).multiplyScalar(u))
      .add(c.clone().sub(a).multiplyScalar(v))
      .multiplyScalar(1.03);
    targetPositions.set([point.x, point.y, point.z], index * 3);
    startPositions.set(randomSpherePoint(6, 8), index * 3);
    qrPositions.set([point.x, point.y, point.z], index * 3);
    randomValues[index] = Math.random();
  }
  triangleGeometry.dispose();

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(targetPositions, 3),
  );
  particleGeometry.setAttribute(
    'aStart',
    new THREE.BufferAttribute(startPositions, 3),
  );
  particleGeometry.setAttribute('aQR', new THREE.BufferAttribute(qrPositions, 3));
  particleGeometry.setAttribute(
    'aRandom',
    new THREE.BufferAttribute(randomValues, 1),
  );

  const particleUniforms = {
    uProgress: { value: 0 },
    uQR: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 22 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uOpacity: { value: 1 },
    uColorA: { value: new THREE.Color(0x9ec2ff) },
    uColorB: { value: new THREE.Color(0xf3dca8) },
  };
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: particleUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uProgress, uQR, uTime, uSize, uPixelRatio;
      attribute vec3 aStart, aQR;
      attribute float aRandom;
      varying float vAlpha, vQR;
      void main() {
        float progress = smoothstep(0.0, 1.0, clamp(uProgress * 1.3 - aRandom * 0.3, 0.0, 1.0));
        vec3 pos = mix(aStart, position, progress);
        float qrProgress = smoothstep(0.0, 1.0, clamp(uQR * 1.35 - aRandom * 0.35, 0.0, 1.0));
        vec3 burst = normalize(position + vec3(0.0001)) * sin(qrProgress * 3.14159) * (1.0 + aRandom * 2.2);
        pos = mix(pos, aQR, qrProgress) + burst;
        pos += vec3(
          sin(uTime * 1.3 + aRandom * 40.0),
          cos(uTime * 1.1 + aRandom * 30.0),
          sin(uTime * 0.9 + aRandom * 20.0)
        ) * 0.018 * (1.0 - qrProgress);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uSize * uPixelRatio * (0.55 + aRandom * 0.9) * (1.0 + qrProgress * 0.5) / -mvPosition.z;
        vAlpha = 0.45 + 0.55 * sin(uTime * 2.6 + aRandom * 60.0);
        vQR = qrProgress;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColorA, uColorB;
      varying float vAlpha, vQR;
      void main() {
        float distanceFromCenter = length(gl_PointCoord - 0.5);
        if (distanceFromCenter > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, distanceFromCenter);
        gl_FragColor = vec4(mix(uColorA, uColorB, vQR), alpha * mix(vAlpha, 1.0, vQR) * uOpacity);
      }
    `,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  gemGroup.add(particles);

  const helix = [];
  [
    [0xd8b87a, 0],
    [0x7fb2ff, Math.PI],
  ].forEach(([color, phase]) => {
    const points = [];
    for (let index = 0; index <= 220; index += 1) {
      const progress = index / 220;
      const angle = progress * Math.PI * 5 + phase;
      const radius = 3.2 * (1 - progress) + 0.12;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          -3.6 + progress * 5.1,
          Math.sin(angle) * radius * 0.6 - 0.5,
        ),
      );
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 440, 0.022, 6, false);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const headMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), headMaterial);
    scene.add(head);
    helix.push({ curve, geometry, material, mesh, head, headMaterial });
  });

  const framesGroup = new THREE.Group();
  scene.add(framesGroup);
  const memoryFrames = [];
  const resizeHandlers = new Set();
  let pointerX = 0;
  let pointerY = 0;
  let cameraX = 0;
  let cameraY = 0;
  let rotation = 0;
  let disposed = false;
  const timer = new THREE.Timer();
  timer.connect(document);
  let animationFrame = 0;

  function resize() {
    const aspect = window.innerWidth / window.innerHeight;
    baseZ = aspect < 0.75 ? 8.6 : 7;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    particleUniforms.uPixelRatio.value = renderer.getPixelRatio();
    resizeHandlers.forEach((handler) => handler());
  }

  function trackPointer(event) {
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
  }

  function render(timestamp) {
    animationFrame = window.requestAnimationFrame(render);
    timer.update(timestamp);
    if (document.hidden) return;

    const delta = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();
    particleUniforms.uTime.value = time;
    particleUniforms.uProgress.value = state.introProgress;
    rotation += delta * (0.35 + state.spin);
    const qrProgress = state.qr;

    gem.rotation.y = rotation;
    gem.rotation.x = Math.sin(time * 0.5) * 0.12;
    particles.rotation.y = rotation * (1 - qrProgress);
    gemGroup.position.set(
      0,
      THREE.MathUtils.lerp(state.gemY + Math.sin(time * 1.1) * 0.05, 0.35, qrProgress),
      0,
    );
    gemGroup.scale.setScalar(THREE.MathUtils.lerp(state.gemScale, 1, qrProgress));
    gemMaterial.opacity = state.introProgress * (1 - qrProgress);
    edgeMaterial.opacity = state.introProgress * (1 - qrProgress) * 0.5;
    particleUniforms.uSize.value = THREE.MathUtils.lerp(22, 30, qrProgress);

    helix.forEach(({ curve, geometry, material, mesh, head, headMaterial }) => {
      const indexCount = geometry.index?.count ?? 0;
      geometry.setDrawRange(
        0,
        Math.floor((indexCount * state.helixProgress) / 3) * 3,
      );
      material.opacity = state.helixOpacity * (1 - qrProgress) * 0.9;
      head.position.copy(curve.getPointAt(Math.max(0.001, state.helixProgress)));
      headMaterial.opacity =
        state.helixOpacity *
        (1 - qrProgress) *
        (state.helixProgress > 0.005 && state.helixProgress < 0.995 ? 1 : 0);
      mesh.visible = material.opacity > 0.001;
    });

    framesGroup.position.z = state.framesZ;
    memoryFrames.forEach(({ mesh, material }) => {
      const worldZ = mesh.position.z + state.framesZ;
      const proximity = THREE.MathUtils.clamp((baseZ - 0.6 - worldZ) / 2.2, 0, 1);
      material.opacity = state.framesOpacity * (1 - qrProgress) * proximity;
      mesh.visible = material.opacity > 0.001;
    });

    pointLights[0].position.set(
      Math.cos(time * 0.7) * 3,
      1.5,
      Math.sin(time * 0.7) * 3,
    );
    pointLights[1].position.set(
      Math.cos(time * 0.5 + 2) * 3,
      -1,
      Math.sin(time * 0.5 + 2) * 3,
    );
    pointLights[2].position.set(
      Math.cos(time * 0.9 + 4) * 3,
      0.5,
      Math.sin(time * 0.9 + 4) * 3,
    );
    stars.rotation.y = time * 0.01;

    cameraX += (pointerX * 0.5 - cameraX) * 0.04;
    cameraY += (-pointerY * 0.35 - cameraY) * 0.04;
    camera.position.set(cameraX, cameraY, baseZ);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', trackPointer, { passive: true });
  resize();
  render();

  return {
    THREE,
    scene,
    state,
    renderer,
    framesGroup,
    memoryFrames,
    canvas,
    uniforms: particleUniforms,
    setQrPattern({ size, darkModules }) {
      if (!Number.isInteger(size) || size < 1 || darkModules.length === 0) {
        throw new Error('La grille du code QR est invalide.');
      }

      const shuffledModules = darkModules.map(([row, column]) => [row, column]);
      for (let index = shuffledModules.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffledModules[index], shuffledModules[swapIndex]] = [
          shuffledModules[swapIndex],
          shuffledModules[index],
        ];
      }

      const qrSize = window.innerWidth / window.innerHeight < 0.75 ? 2.3 : 2.6;
      const attribute = particleGeometry.attributes.aQR;
      for (let index = 0; index < particleCount; index += 1) {
        const [row, column] = shuffledModules[index % shuffledModules.length];
        attribute.setXYZ(
          index,
          ((column + 0.5 + (Math.random() - 0.5) * 0.8) / size) * qrSize -
            qrSize / 2,
          qrSize / 2 -
            ((row + 0.5 + (Math.random() - 0.5) * 0.8) / size) * qrSize,
          (Math.random() - 0.5) * 0.05,
        );
      }
      attribute.needsUpdate = true;
    },
    addResizeHandler(handler) {
      resizeHandlers.add(handler);
      handler();
      return () => resizeHandlers.delete(handler);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      timer.dispose();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', trackPointer);
      renderer.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      starGeometry.dispose();
      stars.material.dispose();
      gemMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      helix.forEach(({ geometry, material, head, headMaterial }) => {
        geometry.dispose();
        material.dispose();
        head.geometry.dispose();
        headMaterial.dispose();
      });
      memoryFrames.forEach(({ mesh, material }) => {
        mesh.geometry.dispose();
        material.map?.dispose();
        material.dispose();
      });
    },
  };
}
