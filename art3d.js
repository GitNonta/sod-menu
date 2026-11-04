/* Optional 3D product art (three.js).
   One WebGL canvas is reused and moved into the active slide's stage, so the
   page never holds more than one context. Every product is the real cut-out
   photo on a depth-layered plane — no stand-in models. */

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
let lastFrame = 0;
let textures = new Map();

const look = { x: 0, y: 0, targetX: 0, targetY: 0, dragging: false, lastX: 0, lastY: 0 };
const tilt = { x: 0, y: 0, listening: false };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function resize() {
  if (!renderer || !currentStage) return;
  const w = Math.max(1, currentStage.clientWidth);
  const h = Math.max(1, currentStage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  layoutPlane();
}

function layoutPlane() {
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

function getTexture(src, onReady) {
  let tex = textures.get(src);
  if (!tex) {
    tex = new THREE.TextureLoader().load(
      src,
      () => {
        layoutPlane();
        (tex.__ready || []).forEach((fn) => fn());
      },
      undefined,
      () => console.warn('[art3d] texture failed:', src)
    );
    tex.__ready = [];
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    textures.set(src, tex);
  }
  if (!onReady) return tex;
  if (tex.image && tex.image.width) onReady();
  else (tex.__ready = tex.__ready || []).push(onReady);
  return tex;
}

function clearGroup() {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.((n) => {
      n.geometry?.dispose();
      if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
      else n.material?.dispose();
    });
    group.remove(child);
  }
  meshes = [];
}

function buildPlane(src) {
  clearGroup();
  // hide the plain <img> only once the photo is really painted on the canvas
  currentTexture = getTexture(src, () => {
    if (currentSrc === src && currentStage) currentStage.classList.add('is-3d');
  });

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
  layoutPlane();
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  lastFrame = now;
  if (!renderer) return;

  // the real product photo, swaying a little with drag / device tilt
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
  lastFrame = 0;
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
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

/* probe first (and release the probe) so three never logs a context error */
function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (_) {
    return false;
  }
}

export async function init() {
  if (renderer) return true;
  if (!hasWebGL()) throw new Error('WebGL unavailable');
  THREE = await import('three');

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6157, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.4, 3.2, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe6c9, 1.2);
  rim.position.set(-3, 1.4, -2.4);
  scene.add(rim);

  wireInput();
  canvas.__art3d = { look };
  return true;
}

export function show(stage, src) {
  if (!renderer || !stage || !src) return;
  if (currentStage && currentStage !== stage) currentStage.classList.remove('is-3d');
  currentStage = stage;
  if (canvas.parentNode !== stage) stage.appendChild(canvas);
  resize();
  if (currentSrc !== src) {
    currentSrc = src;
    buildPlane(src); // the real product photo, never a stand-in model
  }
  start();
}

export function clear() {
  if (currentStage) currentStage.classList.remove('is-3d');
  currentStage = null;
  currentSrc = null;
  stop();
}
