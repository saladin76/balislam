import { checkScript, configFromFile } from "./check";
import { domainIds, loadChannel } from "../channel";
import type { ParsedScript } from "./types";

/** فحص السكريبت بقواعد القناة الحالية (مجالاتها، وحرية عدد الفصول، واشتراط الخطوة العملية). */
export const checkForChannel = (script: ParsedScript) => {
  const ch = loadChannel();
  return checkScript(script, { ...configFromFile(), domains: domainIds(ch), fixedChapters: ch.script?.fixedChapters, practicalStep: ch.script?.practicalStep });
};
