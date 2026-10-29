import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { fontFiles } from "../../brand/fonts";

let loading: Promise<void> | null = null;

const loadAll = (): Promise<void> => {
  if (!loading) {
    loading = Promise.all(
      fontFiles.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return loading;
};

/** يؤخر الرندر حتى تُحمّل كل الخطوط، فلا يظهر إطار بخط بديل. */
export const useBrandFonts = (): boolean => {
  const [handle] = useState(() => delayRender("تحميل الخطوط"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadAll()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error("تعذر تحميل الخطوط", err);
        continueRender(handle);
      });
  }, [handle]);
  return ready;
};
