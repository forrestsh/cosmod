import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

// =====================================================================
// FCC lattice geometry
// =====================================================================
const NAMES = ['A','B','C','D','E','F','a','b','c','d','e','f'];
const DIRS = [
  [ 0,+1,+1], [+1, 0,+1], [+1,+1, 0],   // A B C  forward (+,+,+) octant
  [+1,-1, 0], [ 0,+1,-1], [-1, 0,+1],   // D E F  forward 4-cycle members
  [ 0,-1,-1], [-1, 0,-1], [-1,-1, 0],   // a b c  backward
  [-1,+1, 0], [ 0,-1,+1], [+1, 0,-1],   // d e f  backward 4-cycle members
];

// Color by family — encodes physics:
// A-ring (gun)         A=amber  B=orange  C=red          → warm
// forward 4-cycle      D=emerald E=teal   F=cyan         → cool
// backward 4-cycle     a/b/c    pale warm  (anti-gun)
//                      d/e/f    pale cool   (anti-quark)
const COLORS = [
  0xfbbf24, 0xfb923c, 0xef4444,   // A B C
  0x10b981, 0x14b8a6, 0x06b6d4,   // D E F
  0xfde68a, 0xfed7aa, 0xfecaca,   // a b c
  0x6ee7b7, 0x5eead4, 0x67e8f9,   // d e f
];

// =====================================================================
// Rules
// =====================================================================

// Rule P1: A-ring + forward 4-cycle + backward 4-cycle + Aa↔Bb pair swap
function buildRuleP1() {
  const rt = new Int32Array(4096);
  for (let i = 0; i < 4096; i++) rt[i] = i;
  rt[1] = 3; rt[3] = 6; rt[6] = 1;                              // A-ring
  rt[2] = 8;  rt[8] = 16; rt[16] = 32; rt[32] = 2;              // B→D→E→F→B
  rt[128] = 512; rt[512] = 1024; rt[1024] = 2048; rt[2048] = 128; // b→d→e→f→b
  rt[65] = 130; rt[130] = 65;                                    // Aa ↔ Bb
  return rt;
}

// 6-cycle: extend pair swap into a colour wheel
function buildRule6Cycle() {
  const rt = buildRuleP1();
  rt[65] = 130; rt[130] = 260; rt[260] = 520;
  rt[520] = 1040; rt[1040] = 2080; rt[2080] = 65;
  return rt;
}

// rt_FCC: original light-speed gun rule
function buildRuleFCC() {
  const rt = new Int32Array(4096);
  for (let i = 0; i < 4096; i++) rt[i] = i;
  rt[1] = 3; rt[3] = 6; rt[6] = 1;
  return rt;
}

const popcount = (n) => {
  n = n - ((n>>1)&0x55555555);
  n = (n&0x33333333) + ((n>>2)&0x33333333);
  return (((n+(n>>4))&0x0f0f0f0f) * 0x01010101 >> 24) & 0x3f;
};

const step = (cells, rt) => {
  const incoming = new Map();
  for (const [key, state] of cells) {
    if (!state) continue;
    const [x,y,z] = key.split(',').map(Number);
    for (let d = 0; d < 12; d++) {
      if (state & (1<<d)) {
        const nk = `${x+DIRS[d][0]},${y+DIRS[d][1]},${z+DIRS[d][2]}`;
        incoming.set(nk, (incoming.get(nk)||0) | (1<<d));
      }
    }
  }
  const out = new Map();
  for (const [key, state] of incoming) {
    const next = rt[state];
    if (next) out.set(key, next);
  }
  return out;
};

// =====================================================================
// Physics scenarios — each tells a specific story from the report
// =====================================================================

const SCENARIOS = {
  baryon: {
    name: 'BDEF 重子',
    desc: '4-bit 束缚态。周期 4 心跳：紧凑 → 散开 → 紧凑',
    rule: buildRuleP1(),
    init: () => new Map([['0,0,0', 2|8|16|32]]),
    maxFrames: 25,
    annotations: {
      0: '紧凑态：4 bits 重叠在原点',
      4: '回归紧凑态。漂移 +(1,0,1)',
      8: '再一次紧凑。速度 √2/4 ≈ 0.354c',
    },
  },
  pair_annihilate: {
    name: 'B + b 对湮灭',
    desc: 'B 和 b 头对头相遇 → 湮灭为 A+a → gun 点燃',
    rule: buildRuleP1(),
    init: () => new Map([['-1,0,-1', 2], ['1,0,1', 128]]),
    maxFrames: 30,
    annotations: {
      0: 'B (粒子) + b (反粒子) 相向而行',
      1: '相遇！B+b → A+a 湮灭事件',
      2: 'A 和 a 分开。A 即将启动 gun',
      3: 'gun 点燃！A→A+B 永续信号流',
    },
  },
  collision: {
    name: '重子-反重子对撞',
    desc: '完整剧本：t=13 Compton 辐射 / t=16 碰撞核 / t=19 湮灭 / t=20 gun 点燃',
    rule: buildRule6Cycle(),
    init: () => new Map([
      ['-4,0,-4', 2|8|16|32],
      ['4,0,4', 128|512|1024|2048],
    ]),
    maxFrames: 40,
    annotations: {
      0: 'BDEF 重子 (-4,0,-4) vs bdef 反重子 (4,0,4)',
      12: '即将相遇！紧凑态',
      13: 'Compton 辐射：原点出现 {C,c}',
      16: '碰撞核：6 bits 聚集',
      19: '湮灭事件：{A,a} 出现',
      20: 'gun 点燃 + Compton wires 飞远',
    },
  },
  light_gun: {
    name: 'Light-speed gun (rt_FCC)',
    desc: '最经典的 rt_FCC：A-cycle 产生光速 gun',
    rule: buildRuleFCC(),
    init: () => new Map([['0,0,0', 1]]),
    maxFrames: 20,
    annotations: {
      0: '种子：单 A bit',
      1: 'A → A+B (cycle 启动)',
      2: 'B 尾迹脱落，gun 头沿 +(0,1,1) 推进',
    },
  },
  six_cycle: {
    name: '色轮 F+f → gun',
    desc: '6-cycle 规则下 F+f 触发 A+a 嬗变 → gun 点燃',
    rule: buildRule6Cycle(),
    init: () => new Map([['-1,0,-1', 32], ['1,0,1', 2048]]),
    maxFrames: 20,
    annotations: {
      0: 'F + f 头对头相向',
      1: 'F+f → A+a 嬗变（色轮闭环）',
      2: 'gun 点燃 + a 自由 wire',
    },
  },
};

// Pre-compute frames
const computeFrames = (scenarioKey) => {
  const s = SCENARIOS[scenarioKey];
  const frames = [s.init()];
  for (let i = 1; i < s.maxFrames; i++) {
    const next = step(frames[i-1], s.rule);
    frames.push(next);
    if (next.size === 0) break;
  }
  return frames;
};

// =====================================================================
// Component
// =====================================================================

export default function FCCParticleViz() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [scenarioKey, setScenarioKey] = useState('collision');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [trails, setTrails] = useState(true);

  const frames = useMemo(() => computeFrames(scenarioKey), [scenarioKey]);
  const totalFrames = frames.length;
  // After a scenario switch, `frame` may briefly exceed the new totalFrames
  // before the reset effect runs. Clamp everything that depends on frame.
  const safeFrame = Math.min(frame, totalFrames - 1);
  const currentCells = frames[safeFrame];

  // Aggregate stats
  let bitCount = 0;
  for (const [, s] of currentCells) bitCount += popcount(s);

  const annotation = SCENARIOS[scenarioKey].annotations[safeFrame];

  // ------------------------------------------------------------------
  // Three.js scene init
  // ------------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050a);

    // Subtle radial gradient via large background sphere
    const bgGeo = new THREE.SphereGeometry(50, 32, 16);
    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float d = length(vPos) / 50.0;
          vec3 c1 = vec3(0.02, 0.02, 0.06);
          vec3 c2 = vec3(0.06, 0.04, 0.12);
          gl_FragColor = vec4(mix(c1, c2, d), 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(bgGeo, bgMat));

    const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfff5e0, 0.9);
    key.position.set(8, 10, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a90e2, 0.4);
    fill.position.set(-6, -3, -8);
    scene.add(fill);

    // Ghost lattice points (FCC sublattice)
    const ghostGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x252535 });
    const ghostGroup = new THREE.Group();
    const range = 6;
    for (let x = -range; x <= range; x++)
      for (let y = -range; y <= range; y++)
        for (let z = -range; z <= range; z++) {
          if ((x+y+z) % 2 !== 0) continue;
          const m = new THREE.Mesh(ghostGeo, ghostMat);
          m.position.set(x, y, z);
          ghostGroup.add(m);
        }
    scene.add(ghostGroup);

    // Origin marker
    const originGeo = new THREE.RingGeometry(0.18, 0.22, 24);
    const originMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const originRing = new THREE.Mesh(originGeo, originMat);
    scene.add(originRing);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    const trailGroup = new THREE.Group();
    scene.add(trailGroup);

    // ------------- Camera + touch controls -------------
    let rotY = 0.6, rotX = 0.35;
    let cameraDist = 13;
    let isDown = false, lastX = 0, lastY = 0;
    let pinchDist0 = null;

    const updateCamera = () => {
      const cy = Math.cos(rotY), sy = Math.sin(rotY);
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      camera.position.set(
        cameraDist * cy * cx,
        cameraDist * sx,
        cameraDist * sy * cx
      );
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const onDown = (e) => {
      if (e.touches && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist0 = Math.hypot(dx, dy);
        isDown = false;
        return;
      }
      isDown = true;
      const t = e.touches ? e.touches[0] : e;
      lastX = t.clientX; lastY = t.clientY;
    };

    const onMove = (e) => {
      if (e.touches && e.touches.length === 2 && pinchDist0 !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.hypot(dx, dy);
        cameraDist = Math.max(5, Math.min(40, cameraDist * (pinchDist0 / d)));
        pinchDist0 = d;
        updateCamera();
        e.preventDefault();
        return;
      }
      if (!isDown) return;
      const t = e.touches ? e.touches[0] : e;
      rotY += (t.clientX - lastX) * 0.01;
      rotX += (t.clientY - lastY) * 0.01;
      rotX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotX));
      lastX = t.clientX; lastY = t.clientY;
      updateCamera();
      e.preventDefault();
    };

    const onUp = () => { isDown = false; pinchDist0 = null; };

    const onWheel = (e) => {
      cameraDist = Math.max(5, Math.min(40, cameraDist + e.deltaY * 0.012));
      updateCamera();
      e.preventDefault();
    };

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onDown, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onUp);

    const onResize = () => {
      const W = mount.clientWidth, H = mount.clientHeight;
      if (!W || !H) return;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H, false); // false = don't override the canvas style
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    };
    window.addEventListener('resize', onResize);
    // ResizeObserver catches layout-only resizes that don't fire window.resize
    // (orientation change, parent reflow, dynamic UI bars).
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(mount);

    // Spin origin ring slowly
    let raf;
    const tick = () => {
      originRing.rotation.x += 0.005;
      originRing.rotation.y += 0.008;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    sceneRef.current = { scene, dynamicGroup, ghostGroup, trailGroup };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onUp);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // ------------------------------------------------------------------
  // Repaint dynamics
  // ------------------------------------------------------------------
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const { dynamicGroup, ghostGroup, trailGroup } = ctx;

    ghostGroup.visible = showGhost;

    // Defensive guard: when scenarioKey just changed, frames was rebuilt but
    // setFrame(0) may not have flushed yet. currentCells / frames[f] could be
    // undefined for the stale frame index. Skip this paint — the next render
    // will run with frame=0 and valid data.
    if (!currentCells) return;

    // Clear current frame meshes
    while (dynamicGroup.children.length) {
      const c = dynamicGroup.children.pop();
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
    while (trailGroup.children.length) {
      const c = trailGroup.children.pop();
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }

    // Trails: render previous N frames as fading dots
    if (trails) {
      const trailGeo = new THREE.SphereGeometry(0.08, 6, 6);
      for (let dt = 1; dt <= 6; dt++) {
        const f = safeFrame - dt;
        if (f < 0) break;
        const trailCells = frames[f];
        if (!trailCells) continue;  // out of range after scenario switch
        const opacity = 0.35 * (1 - dt/7);
        for (const [key] of trailCells) {
          const [x,y,z] = key.split(',').map(Number);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity,
          });
          const m = new THREE.Mesh(trailGeo, mat);
          m.position.set(x,y,z);
          trailGroup.add(m);
        }
      }
    }

    // Geometries shared
    const sphereGeo = new THREE.SphereGeometry(0.36, 16, 12);
    const arrowShaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6);
    const arrowHeadGeo = new THREE.ConeGeometry(0.09, 0.16, 8);

    for (const [key, state] of currentCells) {
      const [x,y,z] = key.split(',').map(Number);

      // Sphere color: blend of all active bits
      let r=0, g=0, b=0, n=0;
      for (let d = 0; d < 12; d++) {
        if (state & (1<<d)) {
          const c = COLORS[d];
          r += (c >> 16) & 0xff;
          g += (c >> 8) & 0xff;
          b += c & 0xff;
          n++;
        }
      }
      const sphereColor = (Math.floor(r/n) << 16) | (Math.floor(g/n) << 8) | Math.floor(b/n);

      const sphereMat = new THREE.MeshLambertMaterial({
        color: sphereColor,
        transparent: true,
        opacity: 0.55 + Math.min(0.3, n * 0.06),
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      // Make multi-bit (composite) cells slightly bigger
      const scale = n >= 4 ? 1.4 : (n >= 2 ? 1.15 : 1.0);
      sphere.scale.setScalar(scale);
      dynamicGroup.add(sphere);

      // Arrows for each bit
      for (let d = 0; d < 12; d++) {
        if (!(state & (1<<d))) continue;
        const dirVec = new THREE.Vector3(...DIRS[d]).normalize();
        const arrowMat = new THREE.MeshLambertMaterial({ color: COLORS[d] });

        const shaft = new THREE.Mesh(arrowShaftGeo, arrowMat);
        shaft.position.copy(new THREE.Vector3(x,y,z).add(dirVec.clone().multiplyScalar(0.55)));
        shaft.lookAt(new THREE.Vector3(x,y,z).add(dirVec.clone().multiplyScalar(2)));
        shaft.rotateX(Math.PI/2);
        dynamicGroup.add(shaft);

        const head = new THREE.Mesh(arrowHeadGeo, arrowMat);
        head.position.copy(new THREE.Vector3(x,y,z).add(dirVec.clone().multiplyScalar(0.88)));
        head.lookAt(new THREE.Vector3(x,y,z).add(dirVec.clone().multiplyScalar(2)));
        head.rotateX(Math.PI/2);
        dynamicGroup.add(head);
      }
    }
  }, [currentCells, showGhost, trails, safeFrame, frames]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setFrame((f) => {
        if (f >= totalFrames - 1) { setPlaying(false); return f; }
        return f + 1;
      });
    }, 700);
    return () => clearInterval(id);
  }, [playing, totalFrames]);

  useEffect(() => { setFrame(0); setPlaying(false); }, [scenarioKey]);

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <div style={{
      width: '100%',
      height: '100vh',          /* fallback for browsers without dvh */
      maxHeight: '100dvh',      /* dynamic viewport: shrinks with mobile URL bar */
      background: '#05050a',
      color: '#e8e8ed',
      fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Menlo", monospace',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top header — left padding clears the fixed ← Home pill from ModelShell */}
      <div style={{
        padding: '10px 14px 6px 96px',
        borderBottom: '1px solid #15151f',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: 2,
          color: '#5b5b6a',
          textTransform: 'uppercase',
          marginBottom: 1,
        }}>
          FCC particle dynamics
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#fbbf24',
          letterSpacing: 0.3,
        }}>
          {SCENARIOS[scenarioKey].name}
        </div>
      </div>

      {/* Scenario chips */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 14px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0,
        borderBottom: '1px solid #15151f',
      }}>
        {Object.entries(SCENARIOS).map(([k, s]) => (
          <button
            key={k}
            onClick={() => setScenarioKey(k)}
            style={{
              padding: '6px 12px',
              minHeight: 32,
              border: scenarioKey === k ? '1px solid #fbbf24' : '1px solid #1f1f2c',
              borderRadius: 16,
              background: scenarioKey === k ? '#fbbf2418' : 'transparent',
              color: scenarioKey === k ? '#fbbf24' : '#7a7a90',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              flexShrink: 0,
              letterSpacing: 0.3,
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* 3D viewport */}
      <div
        ref={mountRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          touchAction: 'none',
        }}
      >
        {/* HUD top-left */}
        <div style={{
          position: 'absolute',
          top: 10, left: 12,
          fontSize: 10,
          letterSpacing: 1.2,
          color: '#7a7a90',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <div>
            t <span style={{ color: '#fbbf24', fontSize: 20, fontWeight: 700, letterSpacing: 0 }}>
              {String(safeFrame).padStart(2, '0')}
            </span>
          </div>
          <div style={{ marginTop: 2 }}>
            cells {currentCells.size} · bits {bitCount}
          </div>
        </div>

        {/* HUD top-right: help link + control hints */}
        <div style={{
          position: 'absolute',
          top: 10, right: 12,
          textAlign: 'right',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
        }}>
          <a
            href="/cosmic-grid-particles/manual.html"
            target="_blank"
            rel="noopener"
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: '#fbbf24',
              textTransform: 'uppercase',
              textDecoration: 'none',
              padding: '5px 9px',
              border: '1px solid #fbbf2455',
              borderRadius: 4,
              background: 'rgba(8,8,12,0.7)',
              fontFamily: 'inherit',
            }}
          >
            help ↗
          </a>
          <div style={{
            fontSize: 9,
            letterSpacing: 1.5,
            color: '#3f3f4f',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            drag · rotate<br />pinch · zoom
          </div>
        </div>

        {/* Caption strip at bottom — annotation when present, otherwise scene description.
            Translucent, no fill blocking the 3D view. */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          pointerEvents: 'none',
          textAlign: 'center',
          letterSpacing: 0.2,
          lineHeight: 1.4,
          textShadow: '0 0 8px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,1)',
        }}>
          {annotation ? (
            <div
              key={`anno-${scenarioKey}-${safeFrame}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#fbbf24',
                letterSpacing: 0.4,
                animation: 'captionIn 0.35s ease',
              }}
            >
              {annotation}
            </div>
          ) : (
            <div style={{
              fontSize: 10,
              color: '#9aa0b0',
            }}>
              {SCENARIOS[scenarioKey].desc}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '10px 14px 14px',
        borderTop: '1px solid #15151f',
        flexShrink: 0,
        background: '#02020a',
      }}>
        {/* Frame slider */}
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={frame}
          onChange={(e) => { setFrame(+e.target.value); setPlaying(false); }}
          style={{
            width: '100%',
            height: 32,
            accentColor: '#fbbf24',
            cursor: 'pointer',
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={() => { setFrame(0); setPlaying(false); }} style={btnStyle()}>⟲</button>
          <button onClick={() => { setFrame(Math.max(0, frame - 1)); setPlaying(false); }} style={btnStyle()}>◀</button>
          <button onClick={() => setPlaying(p => !p)} style={btnStyle(true)}>{playing ? '❚❚' : '▶'}</button>
          <button onClick={() => { setFrame(Math.min(totalFrames - 1, frame + 1)); setPlaying(false); }} style={btnStyle()}>▶</button>
          <button
            onClick={() => setTrails(t => !t)}
            style={{ ...btnStyle(false, trails), fontSize: 9, letterSpacing: 1.2 }}
          >TRAILS</button>
          <button
            onClick={() => setShowGhost(g => !g)}
            style={{ ...btnStyle(false, showGhost), fontSize: 9, letterSpacing: 1.2 }}
          >GRID</button>
        </div>
      </div>

      <style>{`
        @keyframes captionIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type=range]::-webkit-slider-thumb {
          width: 18px; height: 18px;
        }
      `}</style>
    </div>
  );
}

const btnStyle = (primary, active) => ({
  flex: 1,
  height: 40,
  border: primary ? '1px solid #fbbf24'
    : active ? '1px solid #fbbf2466'
    : '1px solid #1f1f2c',
  borderRadius: 8,
  background: primary ? '#fbbf2418'
    : active ? '#fbbf2410'
    : '#0a0a14',
  color: primary ? '#fbbf24'
    : active ? '#fbbf24aa'
    : '#a0a0b5',
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
});
