/**
 * The white page of 11 Nov (D89): `SentencesPanel` called `useState`/`useEffect` AFTER `if (!read) return …`, so the
 * first render (still loading) had fewer hooks than the next one and React threw «Rendered more hooks than during
 * the previous render» — step ٢ went blank on the owner's Mac as soon as the preparation was approved.
 *
 * This test reads every React component of the Studio and the engine with the TypeScript parser and refuses a hook
 * call (`useX(…)`) placed after an early `return` in the component's own body (rules of hooks). Hooks inside nested
 * functions (callbacks, inner components) are judged in their own function.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  if (statSync(p).isDirectory()) return n === "node_modules" ? [] : files(p);
  return /\.tsx?$/.test(n) && !n.endsWith(".d.ts") ? [p] : [];
});

// The TypeScript package here is the native compiler (no JS API); @babel/parser (already in the lockfile via the
// build tools) gives the same syntax tree for .tsx.
type N = { type: string; start: number; loc: { start: { line: number } }; [k: string]: unknown };
const isNode = (x: unknown): x is N => Boolean(x && typeof x === "object" && typeof (x as N).type === "string");
const kids = (n: N): N[] => Object.entries(n).flatMap(([k, v]) =>
  k === "loc" || k === "extra" || k.endsWith("Comments") ? [] : Array.isArray(v) ? v.filter(isNode) : isNode(v) ? [v] : []);
const FN = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod", "ClassPrivateMethod"]);
const isScope = (n: N) => FN.has(n.type) || n.type === "ClassDeclaration" || n.type === "ClassExpression";

const hookName = (n: N): string => {
  if (n.type !== "CallExpression") return "";
  const e = n.callee as N;
  const name = e.type === "Identifier" ? String(e.name)
    : e.type === "MemberExpression" && (e.object as N).type === "Identifier" && (e.object as N).name === "React" && (e.property as N).type === "Identifier" ? String((e.property as N).name) : "";
  return /^use[A-Z0-9]/.test(name) ? name : "";
};
/** A hook call in this node, not counting nested functions (they are their own scope). */
const hookIn = (n: N): N | null => {
  if (hookName(n)) return n;
  for (const c of kids(n)) if (!isScope(c)) { const h = hookIn(c); if (h) return h; }
  return null;
};
const returns = (n: N): boolean => n.type === "ReturnStatement" || kids(n).some((c) => !isScope(c) && returns(c));
const componentBodies = (ast: N): { name: string; body: N }[] => {
  const out: { name: string; body: N }[] = [];
  const visit = (n: N) => {
    let name = "", fn: N | undefined;
    if (n.type === "FunctionDeclaration" && n.id) { name = String((n.id as N).name); fn = n; }
    else if (n.type === "VariableDeclarator" && (n.id as N).type === "Identifier" && n.init && FN.has((n.init as N).type)) { name = String((n.id as N).name); fn = n.init as N; }
    // components and custom hooks
    if (fn && (fn.body as N).type === "BlockStatement" && /^(?:[A-Z]|use[A-Z])/.test(name)) out.push({ name, body: fn.body as N });
    kids(n).forEach(visit);
  };
  visit(ast);
  return out;
};

export const hooksAfterEarlyReturn = (file: string, text = readFileSync(file, "utf8")): string[] => {
  const ast = parse(text, { sourceType: "module", plugins: file.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"], errorRecovery: true }).program as unknown as N;
  const bad: string[] = [];
  for (const { name, body } of componentBodies(ast)) {
    let early: N | null = null;
    for (const st of body.body as N[]) {
      if (early) {
        const h = hookIn(st);
        if (h) bad.push(`${path.relative(ROOT, file)}:${h.loc.start.line} ${name}: ${hookName(h)} after the return on line ${early.loc.start.line}`);
      } else if (st.type === "ReturnStatement") break;
      else if (returns(st)) early = st;
    }
  }
  return bad;
};

describe("rules of hooks: no hook after an early return (D89, the white page)", () => {
  it("the checker finds the exact shape of the 11 Nov bug", () => {
    const src = `export const P = () => {\n  const [a] = useState(0);\n  if (!a) return null;\n  const [b] = useState(1);\n  useEffect(() => {}, []);\n  const f = () => useMemo(() => 1, []);\n  return <i>{b}</i>;\n};`;
    const bad = hooksAfterEarlyReturn(path.join(ROOT, "x.tsx"), src);
    expect(bad).toHaveLength(2);
    expect(bad[0]).toMatch(/x\.tsx:4 P: useState after the return on line 3/);
    expect(hooksAfterEarlyReturn(path.join(ROOT, "x.tsx"), src.replace("  if (!a) return null;\n", ""))).toEqual([]);
  });

  it("every Studio and engine component calls its hooks before any early return", () => {
    const all = [...files(path.join(ROOT, "app", "src")), ...files(path.join(ROOT, "src"))];
    expect(all.length).toBeGreaterThan(50);
    expect(all.flatMap((f) => hooksAfterEarlyReturn(f))).toEqual([]);
  });
});
