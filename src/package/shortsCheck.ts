/**
 * `npx bal -c <القناة> shorts-check [<الحلقة>]` (D241): يقول لكل شورت «يمر» أو «مرفوض» بسببه.
 * - حلقة لها خطة: شورتس الخطة (`plan.shorts`، أو قسم لكل شورت في الخطة القديمة) بالبوابة نفسها قبل الرندر.
 * - مسودة «بانتظارك» (`publish.draft.json`): شورتس الحزمة الحالية، ومقترحات المحرر (`editorProposals`) معلَّمة،
 *   بقراءة وصف القص على جمل `script.md` (src/package/shortIdeaDraft.ts).
 * يقرأ ولا يكتب شيئًا.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { channelPaths } from "../channel";
import { listScriptEpisodeDirs } from "../script/episodes";
import { parseScript } from "../script/parse";
import { readPlanFile } from "../plan/io";
import { shortSegments } from "../plan/shorts";
import { checkPlanShorts, planIdeaSentences } from "./shortIdeaPlan";
import { checkDraftShort, scriptIdeaSentences } from "./shortIdeaDraft";
import { RULE_LABEL, type ShortIdeaResult } from "./shortIdea";

export type ShortCheckRow = {
  episode: string;
  source: "plan" | "draft" | "proposal";
  /** رقم الشورت في مصدره (1…) */
  n: number;
  part?: string;
  title: string;
  /** وصف القص كما كُتب (للمسودات) */
  cut?: string;
  status?: string;
  ok: boolean;
  /** القص غير محدد بجمل (لا حكم آلي) */
  unresolved?: string;
  result: ShortIdeaResult | null;
};

type DraftShort = { title?: string; from?: string; part?: string; hook?: string; closingQuestion?: string; youtube?: { title?: string } };
type DraftKit = { shorts?: DraftShort[]; editorProposals?: { shorts?: (DraftShort & { status?: string })[]; parts?: { part?: string; shorts?: (DraftShort & { status?: string })[] }[] } };

export const checkEpisodeShorts = async (episodeDir: string): Promise<ShortCheckRow[]> => {
  const episode = path.basename(episodeDir);
  const rows: ShortCheckRow[] = [];
  const plan = await readPlanFile(path.join(episodeDir, "script.md"));
  if (plan && shortSegments(plan).segments.length) {
    for (const v of checkPlanShorts(plan))
      rows.push({ episode, source: "plan", n: v.n, title: v.title, ok: v.result.ok, result: v.result });
  }
  const draftFile = path.join(episodeDir, "publish.draft.json");
  if (!rows.length && existsSync(draftFile)) {
    const kit = JSON.parse(await readFile(draftFile, "utf8")) as DraftKit;
    const sentences = scriptIdeaSentences(parseScript(await readFile(path.join(episodeDir, "script.md"), "utf8"), "script.md"));
    const add = (source: "draft" | "proposal", list: (DraftShort & { status?: string })[], part?: string) =>
      list.forEach((s) => {
        const v = checkDraftShort(sentences, s);
        rows.push({ episode, source, n: rows.filter((r) => r.source === source).length + 1, ...(s.part ?? part ? { part: s.part ?? part } : {}),
          title: v.title || s.youtube?.title || "", cut: v.from, ...(s.status ? { status: s.status } : {}),
          ok: Boolean(v.result?.ok), ...(v.unresolved ? { unresolved: v.unresolved } : {}), result: v.result });
      });
    add("draft", kit.shorts ?? []);
    add("proposal", kit.editorProposals?.shorts ?? []);
    for (const p of kit.editorProposals?.parts ?? []) add("proposal", p.shorts ?? [], p.part);
  }
  return rows;
};

export const checkChannelShorts = async (episode?: string): Promise<ShortCheckRow[]> => {
  const dir = channelPaths().episodes;
  const eps = (await listScriptEpisodeDirs(dir)).filter((e) => !episode || e.startsWith(`${episode}-`) || e === episode);
  if (episode && !eps.length) throw new Error(`الحلقة ${episode} غير موجودة في هذه القناة.`);
  const rows: ShortCheckRow[] = [];
  for (const e of eps) rows.push(...(await checkEpisodeShorts(path.join(dir, e))));
  return rows;
};

const SOURCE: Record<ShortCheckRow["source"], string> = { plan: "الخطة", draft: "حزمة المسودة", proposal: "مقترح المحرر" };
export const formatShortRows = (rows: ShortCheckRow[]): string => {
  const out: string[] = [];
  for (const r of rows) {
    const head = `${r.episode} · ${SOURCE[r.source]} ${r.n}${r.part ? ` (الجزء ${r.part})` : ""} «${r.title}»`;
    if (r.ok) { out.push(`✓ يمر — ${head}`); continue; }
    out.push(`✗ مرفوض — ${head}`);
    if (r.unresolved) out.push(`    القص غير محدد بجمل: ${r.unresolved}`);
    for (const i of r.result?.issues ?? []) out.push(`    ${RULE_LABEL[i.rule]}: ${i.message}`);
  }
  const ok = rows.filter((r) => r.ok).length;
  out.push(`المجموع: ${rows.length} شورتًا — يمر ${ok}، ومرفوض ${rows.length - ok}.`);
  return out.join("\n");
};
