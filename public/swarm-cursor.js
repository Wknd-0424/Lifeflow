export function mountSwarmCursor(canvas, { count = 36, trail = 520 } = {}) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const motion = matchMedia('(any-hover: hover) and (prefers-reduced-motion: no-preference)');
  const colors = ['#ffd0d3', '#eb8195', '#b0d8c7'];
  const particles = [];
  let frame = 0;
  let lastEmission = -Infinity;

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * scale);
    canvas.height = Math.round(innerHeight * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw(now) {
    context.clearRect(0, 0, innerWidth, innerHeight);
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      const age = (now - particle.start) / trail;
      if (age >= 1) {
        particles.splice(index, 1);
        continue;
      }

      context.globalAlpha = 0.88 * (1 - age) ** 2;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(
        particle.x + particle.dx * age,
        particle.y + particle.dy * age,
        particle.radius * (1 - age * 0.6),
        0, Math.PI * 2
      );
      context.fill();
    }
    frame = particles.length ? requestAnimationFrame(draw) : 0;
  }

  function emit(event) {
    if (!motion.matches || event.pointerType === 'touch') return;
    const now = performance.now();
    if (now - lastEmission < 20) return;
    lastEmission = now;

    for (let index = 0; index < 3; index++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 12 + Math.random() * 28;
      particles.push({
        x: event.clientX,
        y: event.clientY,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        radius: 1.4 + Math.random() * 2.2,
        color: colors[index],
        start: now
      });
    }

    if (particles.length > count) particles.splice(0, particles.length - count);
    if (!frame) frame = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', emit, { passive: true, capture: true });
  motion.addEventListener('change', () => {
    particles.length = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    context.clearRect(0, 0, innerWidth, innerHeight);
  });
}

mountSwarmCursor(document.querySelector('#swarm-cursor'));
