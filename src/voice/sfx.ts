import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { projectRoot } from "../config/paths";
import { sfxLibrary } from "../../brand/sfx";
import type { ElevenLabsClient } from "./elevenlabs";

export const sfxDir = path.join(projectRoot, "assets", "sfx");
export const sfxFile = (id: string) => path.join(sfxDir, `${id}.mp3`);
export const availableSfx = () => sfxLibrary.filter((s) => existsSync(sfxFile(s.id))).map((s) => s.id);

/**
 * يولّد المؤثرات من أوصافها في brand/sfx.ts. الآهات البشرية لا تُولَّد: تُسجَّل بصوت منشد بإذن مكتوب.
 * كل ملف يُسمع ويُعتمد قبل استخدامه في حلقة منشورة.
 */
export const generateSfx = async (client: ElevenLabsClient, ids: string[], opts: { force?: boolean; onProgress?: (m: string) => void } = {}) => {
  await mkdir(sfxDir, { recursive: true });
  const done: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const def = sfxLibrary.find((s) => s.id === id);
    if (!def) {
      skipped.push({ id, reason: "غير موجود في السجل" });
      continue;
    }
    if (def.category === "vocal") {
      skipped.push({ id, reason: "آهة بشرية: تُسجَّل بصوت منشد ولا تُولَّد" });
      continue;
    }
    if (existsSync(sfxFile(id)) && !opts.force) {
      skipped.push({ id, reason: "موجود مسبقًا" });
      continue;
    }
    opts.onProgress?.(`توليد ${id}…`);
    await writeFile(sfxFile(id), await client.soundEffect(def.prompt, def.seconds));
    done.push(id);
  }
  return { done, skipped };
};
