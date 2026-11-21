/**
 * موضع نقطة من الكرة على الشاشة، بالكاميرا نفسها التي يرسم بها Globe3D، لكتابة الأسماء العربية بخط القناة
 * فوق الرسم (HTML) لا داخل WebGL: الاتصال والتشكيل سليمان والخط هو خط الهوية.
 */
import * as THREE from "three";
import { GLOBE_FOV, camPosition, facing, type GlobeCam } from "./globeCamera";
import { toV3, type LonLat } from "./globeSphere";

export const screenOf = (p: LonLat, cam: GlobeCam, width: number, height: number, lift = 1.004): { x: number; y: number; visible: number } => {
  const c = new THREE.PerspectiveCamera(GLOBE_FOV, width / height, 0.01, 100);
  c.position.set(...camPosition(cam));
  c.up.set(0, 1, 0);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...toV3(p, lift)).project(c);
  const f = facing(p, cam);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, visible: Math.max(0, Math.min(1, f / 0.08)) };
};
