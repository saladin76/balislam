/**
 * بيانات لقطات «البدايات» الجديدة (دفاتر الزمن 002–009، bdNN-…) بلا React: تُدمج في HZ_META فتظهر في قائمة «المشهد»
 * بالاستوديو لقناة «دفاتر الزمن». الرسم في ./index.ts. التوثيق: docs/dafatir-alzaman/03-tools.md.
 */
import type { HzMeta } from "../horizon/meta";
import { BD02_META } from "./meta02";
import { BD03_META } from "./meta03";
import { BD04_META } from "./meta04";
import { BD05_META } from "./meta05";
import { BD06_META } from "./meta06";
import { BD07_META } from "./meta07";
import { BD08_META } from "./meta08";
import { BD09_META } from "./meta09";

export const BD_META: Record<string, HzMeta> = {
  ...BD02_META,
  ...BD03_META,
  ...BD04_META,
  ...BD05_META,
  ...BD06_META,
  ...BD07_META,
  ...BD08_META,
  ...BD09_META,
};
