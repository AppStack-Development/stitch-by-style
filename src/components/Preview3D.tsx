import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Pattern } from '../types';
import { buildPlate } from '../lib/plate';
import { t } from '../lib/i18n';

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  group: THREE.Group;
  raf: number;
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
  g.clear();
}

export function Preview3D({ pattern }: { pattern: Pattern }) {
  const wrap = useRef<HTMLDivElement>(null);
  const ctx = useRef<Ctx | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    const el = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-60, 80, 140);
    scene.add(sun);
    const group = new THREE.Group();
    scene.add(group);
    const c: Ctx = { renderer, scene, camera, controls, group, raf: 0 };
    ctx.current = c;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      c.raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(c.raf);
      ro.disconnect();
      controls.dispose();
      disposeGroup(group);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const t = setTimeout(() => {
      const p = pattern;
      const d = p.details;
      const thick = d.baseType === 'print3d' ? d.thicknessMm : 1;
      const key = [p.cols, p.rows, p.pitchMm, thick, d.holeRatio].join(',');
      disposeGroup(c.group);
      const plate = new THREE.BufferGeometry();
      plate.setAttribute('position', new THREE.BufferAttribute(buildPlate(p, thick, d.holeRatio), 3));
      plate.computeVertexNormals();
      const plateColor = d.baseType === 'aida' ? '#f7f3ea' : d.filamentColor;
      c.group.add(new THREE.Mesh(plate, new THREE.MeshStandardMaterial({ color: plateColor, roughness: 0.6, side: THREE.DoubleSide })));

      // threads
      const W = p.cols * p.pitchMm, H = p.rows * p.pitchMm, s = p.pitchMm;
      const stitched: { x: number; y: number; hex: string }[] = [];
      for (let y = 0; y < p.rows; y++) {
        for (let x = 0; x < p.cols; x++) {
          const i = y * p.cols + x;
          const ci = p.cells[i];
          if (p.mask[i] === '2' && ci >= 0 && p.palette[ci]) {
            stitched.push({ x: -W / 2 + (x + 0.5) * s, y: H / 2 - (y + 0.5) * s, hex: p.palette[ci].hex });
          }
        }
      }
      if (stitched.length) {
        // each arm runs corner to corner over the solid middle of its cell, its ends dipping into the
        // corner holes (plate.ts puts the holes on the grid corners)
        const r = s * 0.16;
        const len = s * Math.SQRT2 * 0.96 - 2 * r;
        const cap = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 3, 6);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
        const a = new THREE.InstancedMesh(cap, mat, stitched.length);
        const b = new THREE.InstancedMesh(cap, mat, stitched.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 0.55), pos = new THREE.Vector3();
        const col = new THREE.Color();
        stitched.forEach((st, i) => {
          col.set(st.hex);
          pos.set(st.x, st.y, thick + r * 0.45);
          q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4);
          a.setMatrixAt(i, m.compose(pos, q, sc));
          pos.z = thick + r * 0.75;
          q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 4);
          b.setMatrixAt(i, m.compose(pos, q, sc));
          a.setColorAt(i, col);
          b.setColorAt(i, col.clone().offsetHSL(0, 0, 0.05));
        });
        c.group.add(a, b);
      }

      if (key !== lastKey.current) {
        lastKey.current = key;
        // distance that fits the plate in both directions for the panel's aspect ratio
        const fov = (c.camera.fov * Math.PI) / 180;
        const fitH = H / 2 / Math.tan(fov / 2);
        const fitW = W / 2 / Math.tan(fov / 2) / Math.max(0.3, c.camera.aspect);
        const R = Math.max(fitH, fitW) * 1.1;
        c.camera.position.set(R * 0.08, -R * 0.55, R * 0.83);
        c.camera.up.set(0, 0, 1);
        c.controls.target.set(0, 0, 0);
        c.controls.update();
      }
    }, 250);
    return () => clearTimeout(t);
  }, [pattern]);

  return (
    <div className="preview3d">
      <div ref={wrap} className="preview3d-canvas" />
      <p className="hint">{t('ลากเพื่อหมุน · scroll เพื่อซูม · คลิกขวาลากเพื่อเลื่อน — ภาพจำลองนี้สร้างจากตารางช่อง ใช้ดูภาพรวมก่อนปักจริง', 'Drag to rotate · scroll to zoom · right-drag to pan — a rough preview built from the grid, for an overview before you stitch')}</p>
    </div>
  );
}
