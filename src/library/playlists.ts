/**
 * موضع كل حلقة وقوائم التشغيل التلقائية (D206). دوال نقية: المدخلات (السلاسل وآباؤها، والحلقات، والسجلان، والمجمّعات)
 * تُجمع في `libraryData.ts`، فتُختبر هنا بلا ملفات.
 *
 * - **الموضع:** الرف ← العالِم ← الكتاب ← الجزء، من سلسلة الحلقة وآبائها (D71) ومن السجلين.
 * - **قوائم التشغيل:** لكل كتاب، ولكل عالم، ولكل رف: الحلقات بالترتيب (المنشورة والمخططة)، والعنوان، والوصف.
 *   تُحسب ولا تُرفع (النشر يدوي، D53): ينسخها المالك إلى يوتيوب. وعند اكتمال كتاب يدخل فيديوه المجمّع (D167)
 *   قائمة العالِم مكان أجزائه. كل نص يمر على فحص الآثار (القاعدة الأولى).
 */
import type { SeriesConfig } from "../channel/series";
import type { Book, Scholar } from "./shared";
import { findTraces } from "../package/traces";

export type LibEpisode = {
  id: string;
  series: string;
  number?: number;
  title: string;
  /** منشورة بتاريخ، أو مجدولة، أو قيد الإنتاج */
  state: { kind: "published"; date: string } | { kind: "scheduled"; date: string } | { kind: "production" };
};
export type Compilation = { name: string; title: string; series?: string };

export type Place = {
  shelf?: { id: string; name: string };
  scholar?: { id: string; name: string; series: string };
  book?: { id: string; title: string; series: string; parts: number | null };
  /** رقم الجزء في سلسلة الكتاب */
  part?: number;
};

const ancestry = (series: SeriesConfig[], id: string): SeriesConfig[] => {
  const by = new Map(series.map((s) => [s.id, s]));
  const out: SeriesConfig[] = [];
  const seen = new Set<string>();
  for (let cur = by.get(id); cur && !seen.has(cur.id); cur = cur.parent ? by.get(cur.parent) : undefined) {
    seen.add(cur.id);
    out.unshift(cur);
  }
  return out;
};

/** موضع الحلقة: الرف أعلى السلسلة، والعالِم والكتاب من السجلين بمطابقة السلسلة أو أحد آبائها */
export const placeOf = (ep: Pick<LibEpisode, "series" | "number">, series: SeriesConfig[], scholars: Scholar[], books: Book[]): Place => {
  const chain = ancestry(series, ep.series);
  const ids = new Set(chain.map((s) => s.id));
  const place: Place = {};
  const top = chain[0];
  if (top && top.id !== "general" && top.kind === "category") place.shelf = { id: top.id, name: top.name };
  const book = books.find((b) => ids.has(b.series));
  if (book) {
    place.book = { id: book.id, title: book.title, series: book.series, parts: book.parts };
    if (book.series === ep.series && ep.number) place.part = ep.number;
  }
  const scholar = scholars.find((s) => ids.has(s.series)) ?? (book?.scholar ? scholars.find((s) => s.id === book.scholar) : undefined);
  if (scholar) place.scholar = { id: scholar.id, name: scholar.name, series: scholar.series };
  return place;
};

export type PlaylistItem = { kind: "episode"; episode: string; title: string; state: LibEpisode["state"]; part?: number }
  | { kind: "compilation"; name: string; title: string; book: string }
  | { kind: "intro"; channel: string; episode: string; title: string };
export type Playlist = {
  kind: "book" | "scholar" | "shelf";
  id: string;
  title: string;
  description: string;
  items: PlaylistItem[];
  /** تنبيه للمالك (مثل حلقة التعريف تُضاف من «دفاتر الزمن» بخاصية التعاون) */
  notes: string[];
  /** أثر أدوات الإنتاج في العنوان أو الوصف: القائمة لا تُنسخ حتى يُصلح */
  traces: string[];
};

const byOrder = (a: LibEpisode, b: LibEpisode) => (a.number ?? 999) - (b.number ?? 999) || a.id.localeCompare(b.id);
const epItem = (e: LibEpisode, book?: Book): PlaylistItem => ({ kind: "episode", episode: e.id, title: e.title, state: e.state, ...(book && e.series === book.series && e.number ? { part: e.number } : {}) });
const withTraces = (p: Omit<Playlist, "traces">): Playlist => ({ ...p, traces: [...findTraces(p.title), ...findTraces(p.description)] });

export const COLLAB_NOTE = "حلقة التعريف تُنشر على «دفاتر الزمن»، وتُضاف «زبدة الكتب» شريكًا من YouTube Studio (التفاصيل ← Collaboration ← دعوة متعاون)، فتظهر في قائمة العالِم في القناتين.";

/** الكتاب مكتمل حين تبلغ أجزاؤه المنشورة عددها المخطط، ويوجد مجمّعه */
export const bookComplete = (book: Book, episodes: LibEpisode[], compilations: Compilation[]): Compilation | null => {
  const parts = episodes.filter((e) => e.series === book.series);
  if (!book.parts || parts.filter((e) => e.state.kind === "published").length < book.parts) return null;
  return compilations.find((c) => c.series === book.series || c.name === book.series) ?? null;
};

export const buildPlaylists = (o: { series: SeriesConfig[]; episodes: LibEpisode[]; scholars: Scholar[]; books: Book[]; compilations: Compilation[]; introTitle?: (channel: string, episode: string) => string | undefined }): Playlist[] => {
  const { series, episodes, scholars, books, compilations } = o;
  const inTree = (rootId: string) => episodes.filter((e) => ancestry(series, e.series).some((s) => s.id === rootId)).sort(byOrder);
  const lists: Playlist[] = [];
  for (const b of books) {
    const eps = episodes.filter((e) => e.series === b.series).sort(byOrder);
    const who = b.scholar ? scholars.find((s) => s.id === b.scholar)?.name ?? b.author : b.author;
    lists.push(withTraces({
      kind: "book", id: b.id, title: `«${b.title}» — ${who}`,
      description: `كتاب «${b.title}» لـ${b.author}${b.parts ? ` في ${b.parts} أجزاء` : ""}، جزءًا جزءًا بالترتيب: ماذا يقول الكتاب، وهل يصمد، وما نأخذ منه.`,
      items: eps.map((e) => epItem(e, b)), notes: b.parts && eps.length < b.parts ? [`المخطط ${b.parts} أجزاء، والموجود ${eps.length}.`] : [],
    }));
  }
  for (const s of scholars) {
    const items: PlaylistItem[] = [];
    if (s.intro) {
      items.push({ kind: "intro", channel: s.intro.channel, episode: s.intro.episode, title: o.introTitle?.(s.intro.channel, s.intro.episode) ?? `${s.name}: حياته وزمنه` });
    }
    const theirBooks = books.filter((b) => b.scholar === s.id);
    const done = new Set<string>();
    for (const b of theirBooks) {
      const comp = bookComplete(b, episodes, compilations);
      if (comp) { items.push({ kind: "compilation", name: comp.name, title: comp.title, book: b.id }); done.add(b.series); }
    }
    for (const e of inTree(s.series)) if (!done.has(e.series)) items.push(epItem(e, theirBooks.find((b) => b.series === e.series)));
    lists.push(withTraces({
      kind: "scholar", id: s.id, title: `${s.name} (ت ${s.died.hijri}هـ)`,
      description: `${s.name}: حياته وزمنه، وخريطة كتبه، وكتبه كاملة بالترتيب${theirBooks.length ? `: ${theirBooks.map((b) => `«${b.title}»`).join("، ")}` : ""}.`,
      items, notes: [COLLAB_NOTE, ...(s.review.state !== "owner-approved" ? [`مراجعة المتخصص: ${s.review.state === "not-started" ? "لم تبدأ" : "لم تُعتمد بعد"}.`] : [])],
    }));
  }
  for (const shelf of series.filter((x) => x.kind === "category" && !x.parent && x.id !== "general")) {
    const eps = inTree(shelf.id);
    lists.push(withTraces({
      kind: "shelf", id: shelf.id, title: `رف «${shelf.name}»`,
      description: shelf.description?.trim() ? `${shelf.description.trim()}.` : `كتب رف «${shelf.name}».`,
      items: eps.map((e) => epItem(e, books.find((b) => b.series === e.series))), notes: [],
    }));
  }
  return lists;
};

/** نص القائمة كما يُلصق في يوتيوب (العنوان، والوصف، والحلقات بالترتيب) */
export const playlistText = (p: Playlist): string => {
  const line = (i: PlaylistItem, n: number) => `${n + 1}. ${i.kind === "episode" ? `${i.part ? `الجزء ${i.part}: ` : ""}${i.title}` : i.kind === "compilation" ? `الفيديو المجمّع: ${i.title}` : `التعريف: ${i.title} (على «دفاتر الزمن»)`}`;
  return [p.title, "", p.description, "", ...p.items.map(line)].join("\n");
};
