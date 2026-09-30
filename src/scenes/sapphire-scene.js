import * as THREE from 'three';
import { gsap } from 'gsap';

function buildGemGeometry() {
  const scaleX = 1.16;
  const scaleZ = 0.88;
  const turn = Math.PI * 2;
  const ringSpecs = [
    { count: 8, radius: 0.54, y: 0.4, offset: 0 },
    { count: 16, radius: 0.8, y: 0.27, offset: turn / 32 },
    { count: 32, radius: 1, y: 0.07, offset: 0 },
    { count: 32, radius: 1, y: -0.01, offset: 0 },
    { count: 16, radius: 0.58, y: -0.55, offset: turn / 32 },
  ];
  const rings = ringSpecs.map(({ count, radius, y, offset }) =>
    Array.from({ length: count }, (_, index) => {
      const angle = offset + (index * turn) / count;
      return {
        angle,
        position: new THREE.Vector3(
          Math.cos(angle) * radius * scaleX,
          y,
          Math.sin(angle) * radius * scaleZ,
        ),
      };
    }),
  );
  const positions = [];
  const inside = new THREE.Vector3(0, -0.1, 0);
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  function pushTriangle(first, second, third) {
    edgeA.subVectors(second, first);
    edgeB.subVectors(third, first);
    normal.crossVectors(edgeA, edgeB);
    centroid.copy(first).add(second).add(third).divideScalar(3).sub(inside);
    if (normal.dot(centroid) < 0) [second, third] = [third, second];
    positions.push(
      first.x, first.y, first.z,
      second.x, second.y, second.z,
      third.x, third.y, third.z,
    );
  }

  function stitchRings(firstRing, secondRing) {
    const firstCount = firstRing.length;
    const secondCount = secondRing.length;
    const nextAngle = (ring, index, count) =>
      ring[index % count].angle + Math.floor(index / count) * turn;
    let firstIndex = 0;
    let secondIndex = 0;

    while (firstIndex < firstCount || secondIndex < secondCount) {
      if (
        secondIndex >= secondCount ||
        (firstIndex < firstCount &&
          nextAngle(firstRing, firstIndex + 1, firstCount) <=
            nextAngle(secondRing, secondIndex + 1, secondCount))
      ) {
        pushTriangle(
          firstRing[firstIndex % firstCount].position,
          firstRing[(firstIndex + 1) % firstCount].position,
          secondRing[secondIndex % secondCount].position,
        );
        firstIndex += 1;
      } else {
        pushTriangle(
          firstRing[firstIndex % firstCount].position,
          secondRing[(secondIndex + 1) % secondCount].position,
          secondRing[secondIndex % secondCount].position,
        );
        secondIndex += 1;
      }
    }
  }

  const table = new THREE.Vector3(0, 0.4, 0);
  const culet = new THREE.Vector3(0, -1.08, 0);
  for (let index = 0; index < 8; index += 1) {
    pushTriangle(
      table,
      rings[0][index].position,
      rings[0][(index + 1) % 8].position,
    );
  }
  for (let index = 0; index < rings.length - 1; index += 1) {
    stitchRings(rings[index], rings[index + 1]);
  }
  for (let index = 0; index < 16; index += 1) {
    pushTriangle(
      culet,
      rings[4][index].position,
      rings[4][(index + 1) % 16].position,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  const crown = rings.slice(0, 3).flat().map(({ position }) => position);
  return { geometry, crown };
}

function makeEnvironment(renderer) {
  const environmentScene = new THREE.Scene();
  const environmentObjects = [];
  const enclosure = new THREE.Mesh(
    new THREE.BoxGeometry(24, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x0b1438, side: THREE.BackSide }),
  );
  environmentScene.add(enclosure);
  environmentObjects.push(enclosure);

  function addPanel(width, height, color, intensity, x, y, z) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    environmentScene.add(panel);
    environmentObjects.push(panel);
  }

  addPanel(9, 3, 0xffffff, 7, 0, 10, 0);
  addPanel(3, 7, 0xffffff, 5, -10, 1, 3);
  addPanel(3, 7, 0xe4ecff, 4, 10, 2, -3);
  addPanel(7, 2, 0x7aa2ff, 4, 0, -3, 10);
  addPanel(2, 2, 0xffffff, 10, 5, 6, 9);
  addPanel(1.4, 1.4, 0xffffff, 10, -6, 4, 8);
  addPanel(5, 1.6, 0xffe2b0, 3, -6, -5, -8);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = pmremGenerator.fromScene(environmentScene, 0.02).texture;
  pmremGenerator.dispose();
  environmentObjects.forEach(({ geometry, material }) => {
    geometry.dispose();
    material.dispose();
  });
  return environmentTexture;
}

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070d24, 9, 34);
  const environmentTexture = makeEnvironment(renderer);
  scene.environment = environmentTexture;
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  let baseZ = 7;

  const state = {
    introProgress: 0,
    gemReveal: 0,
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

  const heartCount = isSmall ? 130 : 170;
  const heartOrbit = new Float32Array(heartCount * 4);
  const heartPositions = new Float32Array(heartCount * 3);
  const heartRandom = new Float32Array(heartCount);
  for (let index = 0; index < heartCount; index += 1) {
    heartOrbit.set(
      [
        Math.random() * Math.PI * 2,
        1.55 + Math.random() * 0.35,
        (Math.random() - 0.5) * 0.25,
        0.35 + Math.random() * 0.35,
      ],
      index * 4,
    );
    const angle =
      (index / heartCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.03;
    const scale = 1.62 / 16;
    heartPositions.set(
      [
        16 * Math.sin(angle) ** 3 * scale,
        (
          13 * Math.cos(angle) -
          5 * Math.cos(2 * angle) -
          2 * Math.cos(3 * angle) -
          Math.cos(4 * angle) +
          4.2
        ) * scale,
        -0.35 + (Math.random() - 0.5) * 0.08,
      ],
      index * 3,
    );
    heartRandom[index] = Math.random();
  }

  const heartGeometry = new THREE.BufferGeometry();
  heartGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(heartPositions, 3),
  );
  heartGeometry.setAttribute(
    'aOrbit',
    new THREE.BufferAttribute(heartOrbit, 4),
  );
  heartGeometry.setAttribute(
    'aRandom',
    new THREE.BufferAttribute(heartRandom, 1),
  );
  const heartUniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uFade: { value: 0 },
    uBeat: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uQR: { value: 0 },
  };
  const heartMaterial = new THREE.ShaderMaterial({
    uniforms: heartUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uMorph, uBeat, uPixelRatio;
      attribute vec4 aOrbit;
      attribute float aRandom;
      varying float vTwinkle;
      varying float vGold;

      void main() {
        float angle = aOrbit.x + uTime * aOrbit.w;
        vec3 orbit = vec3(
          cos(angle) * aOrbit.y,
          aOrbit.z + sin(angle * 2.0 + aRandom * 6.0) * 0.08,
          sin(angle) * aOrbit.y
        );
        float tiltXCos = cos(0.38);
        float tiltXSin = sin(0.38);
        orbit = vec3(
          orbit.x,
          orbit.y * tiltXCos - orbit.z * tiltXSin,
          orbit.y * tiltXSin + orbit.z * tiltXCos
        );
        float tiltZCos = cos(-0.18);
        float tiltZSin = sin(-0.18);
        orbit = vec3(
          orbit.x * tiltZCos - orbit.y * tiltZSin,
          orbit.x * tiltZSin + orbit.y * tiltZCos,
          orbit.z
        );

        float morph = smoothstep(
          0.0,
          1.0,
          clamp(uMorph * 1.5 - aRandom * 0.5, 0.0, 1.0)
        );
        vec3 heart = position * (1.0 + uBeat * 0.07);
        vec3 pointPosition = mix(orbit, heart, morph);
        pointPosition.z += sin(morph * 3.14159) * 0.9;

        vec4 modelPosition = modelViewMatrix * vec4(pointPosition, 1.0);
        gl_Position = projectionMatrix * modelPosition;
        vTwinkle = 0.55 + 0.45 * sin(
          uTime * (3.0 + aRandom * 4.0) + aRandom * 50.0
        );
        vGold = step(0.45, aRandom);
        gl_PointSize =
          (38.0 + aRandom * 30.0) *
          (0.8 + vTwinkle * 0.5) *
          uPixelRatio *
          (1.0 + morph * 0.25) /
          -modelPosition.z;
      }
    `,
    fragmentShader: `
      uniform float uFade, uQR;
      varying float vTwinkle;
      varying float vGold;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceFromCenter = length(point);
        float core = 1.0 - smoothstep(0.0, 0.22, distanceFromCenter);
        float cross = max(
          (1.0 - smoothstep(0.0, 0.035, abs(point.x))) *
            (1.0 - smoothstep(0.0, 0.5, abs(point.y))),
          (1.0 - smoothstep(0.0, 0.035, abs(point.y))) *
            (1.0 - smoothstep(0.0, 0.5, abs(point.x)))
        );
        float alpha = max(core, cross * 0.85);
        if (alpha < 0.01) discard;

        vec3 color = mix(
          vec3(0.85, 0.92, 1.0),
          vec3(1.0, 0.86, 0.55),
          vGold
        );
        float visibility = uFade * (1.0 - uQR);
        gl_FragColor = vec4(
          color * 1.3,
          min(1.0, alpha * (0.35 + vTwinkle) * visibility)
        );
      }
    `,
  });
  const heartStars = new THREE.Points(heartGeometry, heartMaterial);
  heartStars.frustumCulled = false;
  gemGroup.add(heartStars);

  const heartCycle = gsap.timeline({ repeat: -1, paused: true });
  heartCycle
    .to(heartUniforms.uFade, {
      value: 1,
      duration: 1.2,
      ease: 'power1.out',
    })
    .to({}, { duration: 4.5 })
    .to(heartUniforms.uMorph, {
      value: 1,
      duration: 2.4,
      ease: 'power2.inOut',
    })
    .to({}, { duration: 3.2 })
    .to(heartUniforms.uFade, {
      value: 0,
      duration: 1.1,
      ease: 'power1.in',
    })
    .set(heartUniforms.uMorph, { value: 0 });

  const { geometry: gemGeometry, crown } = buildGemGeometry();
  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 1.5,
    ior: 1.77,
    roughness: 0.02,
    metalness: 0,
    attenuationColor: new THREE.Color(0x0f34c4),
    attenuationDistance: 0.5,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0,
    iridescence: 0.18,
    iridescenceIOR: 1.4,
    envMapIntensity: 2.4,
    dispersion: 0.2,
    flatShading: true,
  });
  const gem = new THREE.Mesh(gemGeometry, gemMaterial);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x2456f0,
    metalness: 1,
    roughness: 0.06,
    envMapIntensity: 2.6,
    flatShading: true,
    side: THREE.BackSide,
    emissive: 0x0a2380,
    emissiveIntensity: 0.55,
  });
  const core = new THREE.Mesh(gemGeometry, coreMaterial);
  core.scale.setScalar(0.96);
  gem.add(core);
  gem.rotation.order = 'XYZ';

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xbcd3ff,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const edgeGeometry = new THREE.EdgesGeometry(gemGeometry, 1);
  gem.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
  gemGroup.add(gem);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  if (!glowContext) {
    throw new Error('Impossible de créer le halo du saphir.');
  }
  const glowGradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  glowGradient.addColorStop(0, 'rgba(120,160,255,.9)');
  glowGradient.addColorStop(0.35, 'rgba(60,100,255,.35)');
  glowGradient.addColorStop(1, 'rgba(20,40,160,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(6, 6, 1);
  glow.position.z = -1.2;
  gemGroup.add(glow);

  const sparkleCanvas = document.createElement('canvas');
  sparkleCanvas.width = sparkleCanvas.height = 128;
  const sparkleContext = sparkleCanvas.getContext('2d');
  if (!sparkleContext) {
    throw new Error('Impossible de créer les scintillements du saphir.');
  }
  const sparkleGradient = sparkleContext.createRadialGradient(64, 64, 0, 64, 64, 22);
  sparkleGradient.addColorStop(0, 'rgba(255,255,255,1)');
  sparkleGradient.addColorStop(1, 'rgba(255,255,255,0)');
  sparkleContext.fillStyle = sparkleGradient;
  sparkleContext.fillRect(0, 0, 128, 128);
  [[128, 5], [5, 128]].forEach(([width, height]) => {
    const gradient =
      width > height
        ? sparkleContext.createLinearGradient(0, 0, 128, 0)
        : sparkleContext.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    sparkleContext.fillStyle = gradient;
    sparkleContext.fillRect(64 - width / 2, 64 - height / 2, width, height);
  });
  const sparkleTexture = new THREE.CanvasTexture(sparkleCanvas);
  const sparkles = [];
  const sparkleCount = isSmall ? 10 : 16;
  for (let index = 0; index < sparkleCount; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: index % 3 ? 0xffffff : 0xcfe0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const sparkle = new THREE.Sprite(material);
    sparkle.position
      .copy(crown[Math.floor(Math.random() * crown.length)])
      .multiplyScalar(1.02);
    sparkle.userData = {
      phase: Math.random() * 20,
      speed: 0.8 + Math.random() * 1.6,
    };
    gem.add(sparkle);
    sparkles.push(sparkle);
  }

  const particleCount = isSmall ? 2600 : 4200;
  const targetPositions = new Float32Array(particleCount * 3);
  const startPositions = new Float32Array(particleCount * 3);
  const qrPositions = new Float32Array(particleCount * 3);
  const randomValues = new Float32Array(particleCount);
  const triangleGeometry = gemGeometry.index
    ? gemGeometry.toNonIndexed()
    : gemGeometry;
  const trianglePositions = triangleGeometry.attributes.position;
  const triangleCount = trianglePositions.count / 3;
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const triangleAreas = new Float64Array(triangleCount);
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  let totalTriangleArea = 0;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const vertexIndex = triangleIndex * 3;
    const [first, second, third] = vertices;
    first.fromBufferAttribute(trianglePositions, vertexIndex);
    second.fromBufferAttribute(trianglePositions, vertexIndex + 1);
    third.fromBufferAttribute(trianglePositions, vertexIndex + 2);
    edgeA.subVectors(second, first);
    edgeB.subVectors(third, first);
    totalTriangleArea +=
      faceNormal.crossVectors(edgeA, edgeB).length() * 0.5;
    triangleAreas[triangleIndex] = totalTriangleArea;
  }

  const point = new THREE.Vector3();

  for (let index = 0; index < particleCount; index += 1) {
    const targetArea = Math.random() * totalTriangleArea;
    let lowerBound = 0;
    let upperBound = triangleCount - 1;
    while (lowerBound < upperBound) {
      const middle = Math.floor((lowerBound + upperBound) / 2);
      if (targetArea <= triangleAreas[middle]) upperBound = middle;
      else lowerBound = middle + 1;
    }
    const triangle = lowerBound * 3;
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

    edgeA.subVectors(b, a);
    edgeB.subVectors(c, a);
    point
      .copy(a)
      .addScaledVector(edgeA, u)
      .addScaledVector(edgeB, v)
      .multiplyScalar(1.03);
    targetPositions.set([point.x, point.y, point.z], index * 3);
    startPositions.set(randomSpherePoint(6, 8), index * 3);
    qrPositions.set([point.x, point.y, point.z], index * 3);
    randomValues[index] = Math.random();
  }
  if (triangleGeometry !== gemGeometry) triangleGeometry.dispose();

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
  const resizeHandlers = new Set();
  const frameUpdateHandlers = new Set();
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
    heartUniforms.uPixelRatio.value = renderer.getPixelRatio();
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
    const qrProgress = state.qr;
    particleUniforms.uTime.value = time;
    particleUniforms.uProgress.value = state.introProgress;
    heartUniforms.uTime.value = time;
    heartUniforms.uQR.value = qrProgress;
    const beatPhase = (time * 1.1) % 1;
    heartUniforms.uBeat.value =
      (
        Math.exp(-Math.pow((beatPhase - 0.08) / 0.05, 2)) +
        0.6 * Math.exp(-Math.pow((beatPhase - 0.26) / 0.05, 2))
      ) * heartUniforms.uMorph.value;
    rotation += delta * (0.35 + state.spin);

    gem.rotation.y = rotation;
    gem.rotation.x = 0.32 + Math.sin(time * 0.5) * 0.08;
    particles.rotation.y = rotation * (1 - qrProgress);
    gemGroup.position.set(
      0,
      THREE.MathUtils.lerp(state.gemY + Math.sin(time * 1.1) * 0.05, 0.35, qrProgress),
      0,
    );
    gemGroup.scale.setScalar(
      THREE.MathUtils.lerp(state.gemScale, 1, qrProgress) * 0.86,
    );
    const gemVisibility = state.gemReveal * (1 - qrProgress);
    gem.scale.setScalar(Math.max(0.0001, gemVisibility));
    gem.visible = gemVisibility > 0.001;
    edgeMaterial.opacity = gemVisibility * 0.5;
    glowMaterial.opacity =
      0.55 *
      gemVisibility *
      (0.9 + Math.sin(time * 1.4) * 0.1);
    sparkles.forEach((sparkle) => {
      sparkle.getWorldPosition(vertices[0]);
      const facing = THREE.MathUtils.clamp(
        (vertices[0].z - gemGroup.position.z) * 1.5,
        0,
        1,
      );
      const flash = Math.pow(
        Math.max(
          0,
          Math.sin(time * sparkle.userData.speed + sparkle.userData.phase),
        ),
        18,
      );
      sparkle.material.opacity = flash * facing * gemVisibility;
      sparkle.scale.setScalar(0.3 + flash * 0.55);
    });
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
    frameUpdateHandlers.forEach((handler) =>
      handler({ time, delta, baseZ, qrProgress }),
    );
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
    canvas,
    camera,
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
    startHeartCycle() {
      heartCycle.play(0);
    },
    addResizeHandler(handler) {
      resizeHandlers.add(handler);
      handler();
      return () => resizeHandlers.delete(handler);
    },
    addFrameHandler(handler) {
      frameUpdateHandlers.add(handler);
      return () => frameUpdateHandlers.delete(handler);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      timer.dispose();
      heartCycle.kill();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', trackPointer);
      renderer.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      heartGeometry.dispose();
      heartMaterial.dispose();
      starGeometry.dispose();
      stars.material.dispose();
      gemGeometry.dispose();
      gemMaterial.dispose();
      coreMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      glowMaterial.dispose();
      glowTexture.dispose();
      sparkles.forEach((sparkle) => sparkle.material.dispose());
      sparkleTexture.dispose();
      scene.environment = null;
      environmentTexture.dispose();
      helix.forEach(({ geometry, material, head, headMaterial }) => {
        geometry.dispose();
        material.dispose();
        head.geometry.dispose();
        headMaterial.dispose();
      });
    },
  };
}
