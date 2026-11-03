/* Optional 3D product art (three.js).
   One WebGL canvas is reused and moved into the active slide's stage, so the
   page never holds more than one context. Everything here is progressive:
   if WebGL or the module fails, the plain <img> stays as-is. */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const REST_MAX = 0.5;

let THREE = null;
let renderer = null;
let scene = null;
let camera = null;
let group = null;
let canvas = null;
let geometry = null;
let meshes = [];
let currentStage = null;
let currentSrc = null;
let currentTexture = null;
let raf = 0;
let textures = new Map();

const look = { x: 0, y: 0, targetX: 0, targetY: 0, dragging: false, lastX: 0, lastY: 0 };
const tilt = { x: 0, y: 0, listening: false };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function sizeOf(stage) {
  return { w: Math.max(1, stage.clientWidth), h: Math.max(1, stage.clientHeight) };
}

function resize() {
  if (!renderer || !currentStage) return;
  const { w, h } = sizeOf(currentStage);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  layout();
}

function layout() {
  if (!currentTexture?.image || !THREE) return;
  const aspect = currentTexture.image.width / currentTexture.image.height || 1;
  let h = 1.55;
  let w = h * aspect;
  if (w > 1.7) {
    w = 1.7;
    h = w / aspect;
  }
  const next = new THREE.PlaneGeometry(w, h);
  meshes.forEach((m) => (m.geometry = next));
  if (geometry) geometry.dispose();
  geometry = next;
}

function getTexture(src) {
  let tex = textures.get(src);
  if (!tex) {
    tex = new THREE.TextureLoader().load(
      src,
      () => layout(),
      undefined,
      () => console.warn('[art3d] texture failed:', src)
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    textures.set(src, tex);
  }
  return tex;
}

function build(src) {
  currentTexture = getTexture(src);
  while (meshes.length) {
    const m = meshes.pop();
    group.remove(m);
    m.material.dispose();
  }
  // depth silhouette: a few dark copies behind the front face fake thickness
  for (let i = 5; i >= 1; i -= 1) {
    const layer = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: currentTexture,
        transparent: true,
        opacity: 0.12,
        color: 0x000000,
        depthWrite: false,
      })
    );
    layer.position.z = -0.01 * i;
    group.add(layer);
    meshes.push(layer);
  }
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: currentTexture, transparent: true, depthWrite: false })
  );
  group.add(front);
  meshes.push(front);
  layout();
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (!renderer) return;

  const idleY = Math.sin(now * 0.00055) * 0.16;
  const idleX = Math.cos(now * 0.00042) * 0.05;
  const wantY = look.dragging ? look.targetY : look.targetY + tilt.y + idleY;
  const wantX = look.dragging ? look.targetX : look.targetX + tilt.x + idleX;

  look.y += (clamp(wantY, -REST_MAX, REST_MAX) - look.y) * 0.12;
  look.x += (clamp(wantX, -REST_MAX, REST_MAX) - look.x) * 0.12;

  group.rotation.y = look.y;
  group.rotation.x = look.x;
  group.position.y = Math.sin(now * 0.0007) * 0.012;

  renderer.render(scene, camera);
}

function start() {
  if (raf || document.hidden) return;
  raf = requestAnimationFrame(tick);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function enableTilt() {
  if (tilt.listening || !window.DeviceOrientationEvent) return;
  const attach = () => {
    window.addEventListener(
      'deviceorientation',
      (e) => {
        tilt.y = clamp((e.gamma || 0) / 45, -1, 1) * 0.35;
        tilt.x = clamp(((e.beta || 0) - 40) / 60, -1, 1) * 0.18;
      },
      { passive: true }
    );
    tilt.listening = true;
  };
  // iOS needs an explicit permission prompt from a user gesture
  if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    window.DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') attach();
      })
      .catch(() => {});
  } else {
    attach();
  }
}

function wireInput() {
  canvas.addEventListener('pointerdown', (e) => {
    look.dragging = true;
    look.lastX = e.clientX;
    look.lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.classList.add('is-dragging');
    enableTilt();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!look.dragging) return;
    look.targetY += (e.clientX - look.lastX) * 0.01;
    look.targetX += (e.clientY - look.lastY) * 0.01;
    look.lastX = e.clientX;
    look.lastY = e.clientY;
  });
  const release = () => {
    look.dragging = false;
    look.targetX = 0;
    look.targetY = 0;
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

export async function init() {
  if (renderer) return true;
  THREE = await import(/* @vite-ignore */ THREE_URL);

  canvas = document.createElement('canvas');
  canvas.className = 'art3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearAlpha(0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);
  group = new THREE.Group();
  scene.add(group);

  wireInput();
  return true;
}

export function show(stage, src) {
  if (!renderer || !stage || !src) return;
  if (currentStage && currentStage !== stage) currentStage.classList.remove('is-3d');
  currentStage = stage;
  stage.classList.add('is-3d');
  if (canvas.parentNode !== stage) stage.appendChild(canvas);
  resize();
  if (currentSrc !== src) {
    currentSrc = src;
    build(src);
  }
  start();
}

export function clear() {
  if (currentStage) currentStage.classList.remove('is-3d');
  currentStage = null;
  currentSrc = null;
  stop();
}
