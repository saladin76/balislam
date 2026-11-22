/**
 * خامات العدّة من القرص (CC0، materials.ts) للرندر: تُستدعى في المكوّن الأعلى خارج لوحة Three، ولا تُركَّب اللوحة
 * قبل وصولها. delayRender أثناء الرسم نفسه (لا في useEffect)، فلا يُلتقط إطار بلا خامته (اللوحة تُركَّب متأخرة).
 */
import React from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { assetFile } from "./materials";

const cache = new Map<string, THREE.Texture>();

/** ids بالترتيب؛ ما ينتهي بـ «-diff» لونيّ (sRGB) والباقي بيانات (normal، roughness) */
export const useAssetTextures = (ids: string[], repeat: [number, number] = [1, 1]): THREE.Texture[] | null => {
  const ready = ids.every((i) => cache.has(i));
  const [handle] = React.useState(() => (ready ? null : delayRender(`خامات ${ids.join("، ")}`)));
  const [list, setList] = React.useState<THREE.Texture[] | null>(() => (ready ? ids.map((i) => cache.get(i)!) : null));
  React.useEffect(() => {
    if (list) return;
    Promise.all(ids.map((id) => cache.get(id) ?? new THREE.TextureLoader().loadAsync(staticFile(assetFile(id))).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (id.endsWith("-diff")) t.colorSpace = THREE.SRGBColorSpace;
      cache.set(id, t);
      return t;
    }))).then((ts) => { setList(ts); if (handle !== null) continueRender(handle); });
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  return React.useMemo(() => list?.map((x) => { const c = x.clone(); c.repeat.set(...repeat); c.needsUpdate = true; return c; }) ?? null, [list, repeat[0], repeat[1]]); // eslint-disable-line react-hooks/exhaustive-deps
};
