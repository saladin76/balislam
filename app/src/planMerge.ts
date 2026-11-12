import type { Plan } from "../../src/plan/types";
import { SERVER_OWNED_PLAN_FIELDS } from "../../src/plan/revision";

/**
 * «حمّل النسخة الأحدث وأعد تطبيق تعديلي» (D107): a three-way merge of the owner's unsaved edit onto the plan
 * that won on disk. `base` is the plan the edit started from (the last version this page loaded or saved),
 * `mine` the unsaved edit, `theirs` the newest plan from the server. What only one side changed is kept; the same
 * field changed differently on both sides is a conflict, and then nothing is applied (the edit stays pending and
 * can be downloaded). Scenes (by `id`) and chapters (by `number`) merge one by one, so two edits to different
 * scenes never collide. The series stamp, the shorts and `updatedAt` always come from the server.
 */
export type PlanMergeResult = { ok: true; plan: Plan } | { ok: false; conflicts: string[] };

const MISSING = Symbol("missing");
type V = unknown;

const same = (a: V, b: V): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as V[]).length && a.every((x, i) => same(x, (b as V[])[i]));
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, V>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, V>)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, V>)[k], (b as Record<string, V>)[k]));
};
const isObj = (x: V): x is Record<string, V> => typeof x === "object" && x !== null && !Array.isArray(x);
const keyOf = (x: V): string | null => {
  if (!isObj(x)) return null;
  if (typeof x.id === "string") return "id:" + x.id;
  if (typeof x.number === "number" && Array.isArray(x.scenes)) return "chapter:" + x.number;
  return null;
};
const label = (path: string[]) => path.join(" › ") || "الخطة";

const mergeKeyed = (base: V[], mine: V[], theirs: V[], path: string[], conflicts: string[]): V[] => {
  const map = (xs: V[]) => new Map(xs.map((x) => [keyOf(x)!, x]));
  const b = map(base), m = map(mine), t = map(theirs);
  const order = (xs: V[]) => xs.map((x) => keyOf(x)!);
  const ob = order(base), om = order(mine), ot = order(theirs);
  const out = new Map<string, V>();
  for (const k of new Set([...ob, ...om, ...ot])) {
    const v = merge(b.has(k) ? b.get(k) : MISSING, m.has(k) ? m.get(k) : MISSING, t.has(k) ? t.get(k) : MISSING, [...path, k.replace(/^(id|chapter):/, "")], conflicts);
    if (v !== MISSING) out.set(k, v);
  }
  const present = new Set(out.keys());
  // Order: the side that reordered wins; both reordering differently is a conflict.
  const inter = (xs: string[], ys: string[]) => xs.filter((k) => ys.includes(k));
  const mineMoved = !same(inter(om, ob), inter(ob, om));
  const theirsMoved = !same(inter(ot, ob), inter(ob, ot));
  if (mineMoved && theirsMoved && !same(inter(om, ot), inter(ot, om))) conflicts.push(label([...path, "الترتيب"]));
  const live = (xs: string[]) => xs.filter((k) => present.has(k));
  const lead = live(mineMoved ? om : ot);
  const other = live(mineMoved ? ot : om);
  const seq = [...lead];
  for (let i = 0; i < other.length; i++) {
    const k = other[i]!;
    if (seq.includes(k)) continue;
    const before = other.slice(0, i).reverse().find((x) => seq.includes(x));
    seq.splice(before ? seq.indexOf(before) + 1 : 0, 0, k);
  }
  for (const k of present) if (!seq.includes(k)) seq.push(k);
  return seq.map((k) => out.get(k));
};

const merge = (base: V, mine: V, theirs: V, path: string[], conflicts: string[]): V => {
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  if (same(mine, theirs)) return mine;
  if (isObj(mine) && isObj(theirs) && (isObj(base) || base === MISSING)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, V> = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(mine), ...Object.keys(theirs)])) {
      const get = (o: Record<string, V>) => (k in o && o[k] !== undefined ? o[k] : MISSING);
      const v = merge(get(b), get(mine), get(theirs), [...path, k], conflicts);
      if (v !== MISSING) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(mine) && Array.isArray(theirs) && (Array.isArray(base) || base === MISSING)) {
    const b = Array.isArray(base) ? base : [];
    const all = [...b, ...mine, ...theirs];
    const keys = all.map(keyOf);
    if (all.length && keys.every((k) => k !== null)) {
      const unique = (xs: V[]) => new Set(xs.map(keyOf)).size === xs.length;
      if (unique(b) && unique(mine) && unique(theirs)) return mergeKeyed(b, mine, theirs, path, conflicts);
    }
  }
  conflicts.push(label(path));
  return mine;
};

export const mergePlans = (base: Plan, mine: Plan, theirs: Plan): PlanMergeResult => {
  const conflicts: string[] = [];
  const merged = merge(base, mine, theirs, [], conflicts) as Record<string, V>;
  if (conflicts.length) return { ok: false, conflicts: [...new Set(conflicts)] };
  const t = theirs as unknown as Record<string, V>;
  for (const k of [...SERVER_OWNED_PLAN_FIELDS, "updatedAt"]) {
    if (t[k] === undefined) delete merged[k];
    else merged[k] = t[k];
  }
  return { ok: true, plan: merged as unknown as Plan };
};

/** The server-owned fields (series stamp, shorts) of `source` written onto `target`, nothing else touched. */
export const withServerFields = (target: Plan, source: Plan): Plan => {
  const next = { ...target } as Record<string, V>;
  for (const k of SERVER_OWNED_PLAN_FIELDS) {
    const v = (source as unknown as Record<string, V>)[k];
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return next as unknown as Plan;
};
