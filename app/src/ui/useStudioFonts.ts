import { useEffect, useState } from "react";
import { fontFiles } from "../../../brand/fonts";

let loading: Promise<void> | null = null;

/** خطوط القنوات في الاستوديو نفسه (لا في الرندر): ليظهر اسم كل قناة وعناوينها بخط هويتها. */
export const useStudioFonts = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loading ??= Promise.all(
      fontFiles.map(async (f) => {
        try {
          const face = new FontFace(f.family, `url(/${f.file})`, { weight: f.weight, ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}) });
          document.fonts.add(await face.load());
        } catch {
          /* خط ناقص لا يوقف الاستوديو */
        }
      }),
    ).then(() => undefined);
    loading.then(() => setReady(true));
  }, []);
  return ready;
};
