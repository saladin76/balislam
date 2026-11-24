import { checkScript, configFromFile } from "./check";
import { domainIds, loadChannel } from "../channel";
import { listSeries } from "../channel/seriesStore";
import type { ParsedScript } from "./types";

/** فحص السكريبت بقواعد القناة الحالية (مجالاتها، وحرية عدد الفصول، واشتراط الخطوة العملية، وسلاسلها المسجّلة D215). */
export const checkForChannel = (script: ParsedScript) => {
  const ch = loadChannel();
  return checkScript(script, { ...configFromFile(), domains: domainIds(ch), fixedChapters: ch.script?.fixedChapters, practicalStep: ch.script?.practicalStep, series: listSeries(ch.id) });
};
