import { checkScript, configFromFile } from "./check";
import { domainIds, loadChannel } from "../channel";
import type { ParsedScript } from "./types";

/** فحص السكريبت بقواعد القناة الحالية (مجالاتها). */
export const checkForChannel = (script: ParsedScript) => checkScript(script, { ...configFromFile(), domains: domainIds(loadChannel()) });
