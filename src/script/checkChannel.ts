import { checkScript, configFromFile } from "./check";
import { domainIds, loadChannel } from "../channel";
import { listSeries } from "../channel/seriesStore";
import type { ParsedScript } from "./types";
import { characterLineIssues, loadCharacterVoices } from "./characterLines";

/** فحص السكريبت بقواعد القناة الحالية (مجالاتها، وحرية عدد الفصول، واشتراط الخطوة العملية، وسلاسلها المسجّلة D215). */
export const checkForChannel = (script: ParsedScript) => {
  const ch = loadChannel();
  const result = checkScript(script, { ...configFromFile(), domains: domainIds(ch), fixedChapters: ch.script?.fixedChapters, practicalStep: ch.script?.practicalStep, series: listSeries(ch.id) });
  // D249/D250: أقوال الشخصيات بأصوات المكتبة المعتمدة وحدها وبضوابطها (src/script/characterLines.ts)
  const lines = characterLineIssues(script, ch.id, loadCharacterVoices(ch.id), { narratorVoiceId: ch.voice?.id });
  if (!lines.length) return result;
  return { ...result, issues: [...result.issues, ...lines], ok: result.ok && !lines.some((i) => i.level === "error") };
};
