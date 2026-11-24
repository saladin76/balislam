/**
 * D220: «انسخ نص المصدر» — يستبدل `verseText` في كل مشهد يحمل `verseKey` بنص Tanzil بالرسم العثماني لمرجعه كما هو.
 * نسخٌ من المصدر الذي اعتمده المالك لا توليد؛ لا يمس حقلًا غير `verseText`، ولا يُرسل شيئًا إلى أي خدمة صوت.
 *
 *   npx tsx scripts/tanzil-verse-text.mts --file channels/<القناة>/episodes/<الحلقة>/plan.json [--write]
 *   npx tsx scripts/tanzil-verse-text.mts --studio http://127.0.0.1:4321 --channel dafatir-alzaman --episode 001 [--write]
 *
 * بلا --write يطبع ما سيتغير فقط. مع الاستوديو: يقرأ الخطة بواجهته (GET /api/episodes/<id>) ويحفظها بـ PUT
 * /api/episodes/<id>/plan ومعها expectedRevision (planRevision)، وإن تغيّرت الخطة بينهما (409) يعيد القراءة ويعيد
 * التطبيق فوق الأحدث (حتى ٥ مرات)، فلا يكتب فوق تعديل جرى في الأثناء. قناة مجمّدة (D211) لا يُكتب فيها.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tanzilVerses } from "../src/quran/tanzil.ts";
import { withSourceVerseTexts, planVerseMismatches } from "../src/quran/verseSource.ts";
import { planRevision } from "../src/plan/io.ts";
import type { Plan } from "../src/plan/types.ts";

const args = process.argv.slice(2);
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const write = args.includes("--write");
const file = opt("--file"), studio = opt("--studio"), channel = opt("--channel"), episode = opt("--episode");

/** القناة المجمّدة (D211): `frozen` في channels/<القناة>/stock.json */
const frozen = (ch: string) => { try { return Boolean(JSON.parse(readFileSync(`channels/${ch}/stock.json`, "utf8")).frozen); } catch { return false; } };
const report = (changed: { sceneId: string; key: string }[], failed: { sceneId: string; key: string }[]) => {
  console.log(changed.length ? `تتغير ${changed.length}: ${changed.map((c) => `${c.sceneId} (${c.key})`).join("، ")}` : "لا verseText يختلف عن المصدر.");
  if (failed.length) console.log(`مراجع غير صالحة لم تُمس: ${failed.map((c) => `${c.sceneId} (${c.key})`).join("، ")}`);
};

if (file) {
  const ch = /channels\/([^/]+)\//.exec(file)?.[1];
  if (write && ch && frozen(ch)) { console.error(`«${ch}» مجمّدة (D211): لا يُكتب فيها.`); process.exit(1); }
  const raw = readFileSync(file, "utf8");
  const { plan, changed, failed } = withSourceVerseTexts(JSON.parse(raw) as Plan, tanzilVerses);
  report(changed, failed);
  if (write && changed.length) {
    writeFileSync(file, `${JSON.stringify(plan, null, 2)}${raw.endsWith("\n") ? "\n" : ""}`);
    console.log(`كُتب ${file}.`);
  }
} else if (studio && channel && episode) {
  if (write && frozen(channel)) { console.error(`«${channel}» مجمّدة (D211): لا يُكتب فيها.`); process.exit(1); }
  const headers = { Origin: studio, "Content-Type": "application/json" };
  const q = `?channel=${encodeURIComponent(channel)}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const got = await fetch(`${studio}/api/episodes/${episode}${q}`, { headers });
    if (!got.ok) throw Error(`تعذّرت قراءة الخطة (${got.status}).`);
    const current = (await got.json() as { plan: Plan }).plan;
    const { plan, changed, failed } = withSourceVerseTexts(current, tanzilVerses);
    report(changed, failed);
    if (!write || !changed.length) break;
    const put = await fetch(`${studio}/api/episodes/${episode}/plan${q}`, { method: "PUT", headers, body: JSON.stringify({ plan, expectedRevision: planRevision(current) }) });
    const body = await put.json().catch(() => ({})) as Record<string, unknown>;
    if (put.status === 409 && !body.designed) { console.log(`تغيّرت الخطة في الأثناء (409)؛ إعادة القراءة (${attempt}).`); continue; }
    if (!put.ok) throw Error(`رفض الحفظ (${put.status}): ${String(body.error ?? "")}`);
    const after = await (await fetch(`${studio}/api/episodes/${episode}${q}`, { headers })).json() as { plan: Plan };
    const left = planVerseMismatches(after.plan, tanzilVerses);
    console.log(`حُفظ. ما بقي مخالفًا للمصدر: ${left.length ? left.map((m) => `${m.sceneId}: ${m.message}`).join("\n") : "لا شيء"}`);
    break;
  }
} else {
  console.error("الاستعمال: --file <plan.json> [--write] أو --studio <url> --channel <القناة> --episode <الرقم> [--write]");
  process.exit(2);
}
