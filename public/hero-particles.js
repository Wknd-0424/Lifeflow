import * as THREE from '/vendor/three.module.js';

function mountParticleRibbon(canvas, hero) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  } catch {
    return () => {};
  }

  const count = 18000;
  const positions = new Float32Array(count * 3);
  const tones = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const cross = Math.random() * Math.PI * 2;
    const spread = Math.sqrt(Math.random());
    const radius = 1.46 + Math.cos(cross) * spread * 0.42;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.36 + Math.sin(cross) * spread * 0.23;
    positions[i * 3 + 2] = Math.sin(angle * 2) * 0.33 + Math.sin(cross) * spread * 0.36;
    tones[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('tone', new THREE.BufferAttribute(tones, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: 1 },
      crimson: { value: new THREE.Color('#e11d48') },
      ruby: { value: new THREE.Color('#fb7185') },
      deepRuby: { value: new THREE.Color('#9f1239') }
    },
    vertexShader: `
      uniform float time, pixelRatio;
      attribute float tone;
      varying float vTone;

      // Curl of a layered trigonometric noise field.
      vec3 curlField(vec3 p) {
        return vec3(
          1.9 * cos(p.y * 1.9 - time * .24) - 2.3 * cos(p.z * 2.3 + time * .19),
          2.1 * cos(p.z * 2.1 - time * .17) - 1.7 * cos(p.x * 1.7 + time * .21),
          2.0 * cos(p.x * 2.0 - time * .23) - 1.8 * cos(p.y * 1.8 + time * .16)
        );
      }

      void main() {
        vTone = tone;
        vec3 drift = curlField(position) * .029 + curlField(position * 2.3) * .012;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + drift, 1.0);
        gl_PointSize = mix(1.0, 2.5, tone * tone) * pixelRatio;
      }
    `,
    fragmentShader: `
      uniform vec3 deepRuby, crimson, ruby;
      varying float vTone;
      void main() {
        float glow = 1.0 - smoothstep(.05, .5, distance(gl_PointCoord, vec2(.5)));
        vec3 color = mix(deepRuby, crimson, smoothstep(0.0, .72, vTone));
        color = mix(color, ruby, smoothstep(.55, 1.0, vTone));
        gl_FragColor = vec4(color, glow * mix(.12, .42, vTone));
        #include <colorspace_fragment>
      }
    `
  });

  const ribbon = new THREE.Points(geometry, material);
  ribbon.rotation.z = -0.28;
  ribbon.position.x = 0.16;
  const scene = new THREE.Scene();
  scene.add(ribbon);
  const camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 30);
  camera.position.z = 6;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  let frame = 0;
  let lastDraw = -Infinity;
  let visible = true;

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const dpr = THREE.MathUtils.clamp(devicePixelRatio || 1, 1, 1.25);
    const aspect = width / height;
    const halfWidth = Math.max(2.05, aspect * 0.95);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfWidth / aspect;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    material.uniforms.pixelRatio.value = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  }

  function pointerMove(event) {
    if (event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    target.set((event.clientX - bounds.left) / bounds.width - .5,
      (event.clientY - bounds.top) / bounds.height - .5);
  }

  function resetTilt() {
    target.set(0, 0);
  }

  function animate(now) {
    frame = requestAnimationFrame(animate);
    if (now - lastDraw < 32) return;
    lastDraw = now;
    const time = now / 1000;
    material.uniforms.time.value = time;
    const beat = Math.sin(time * Math.PI * 2 * 64 / 60);
    ribbon.scale.setScalar(1 + beat * 0.023);
    tilt.lerp(target, 0.05);
    ribbon.rotation.x = tilt.y * 0.26;
    ribbon.rotation.y = tilt.x * 0.36;
    renderer.render(scene, camera);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    if (!motion.matches && !document.hidden && visible) {
      frame = requestAnimationFrame(animate);
      return;
    }
    ribbon.scale.setScalar(1);
    ribbon.rotation.x = ribbon.rotation.y = 0;
    material.uniforms.time.value = 0;
    renderer.render(scene, camera);
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  intersection.observe(hero);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  hero.addEventListener('pointermove', pointerMove);
  hero.addEventListener('pointerleave', resetTilt);
  motion.addEventListener('change', syncAnimation);
  document.addEventListener('visibilitychange', syncAnimation);
  resize();
  syncAnimation();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    intersection.disconnect();
    hero.removeEventListener('pointermove', pointerMove);
    hero.removeEventListener('pointerleave', resetTilt);
    motion.removeEventListener('change', syncAnimation);
    document.removeEventListener('visibilitychange', syncAnimation);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

const main = document.querySelector('#main');
let activeCanvas;
let dispose;
function syncHero() {
  const canvas = main.querySelector('.hero-particles');
  if (canvas === activeCanvas) return;
  dispose?.();
  activeCanvas = canvas;
  dispose = canvas ? mountParticleRibbon(canvas, canvas.parentElement) : undefined;
}
new MutationObserver(syncHero).observe(main, { childList: true, subtree: true });
syncHero();
