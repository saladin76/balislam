import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 20 Nov crawl: a link to 000-trailer (plan.json without a script) inside the channel opened a broken page and 404s.
describe("a link to a folder that is not an episode stays on the open episode", () => {
  it("checks the episodes list before opening, and says why it stayed", () => {
    const s = readFileSync(path.join(import.meta.dirname, "..", "app/src/App.tsx"), "utf8");
    expect(s).toContain("episodesNow.current?.length && !episodesNow.current.some((e) => e.id === r.episode)");
    expect(s).toContain("ليست حلقة في هذه القناة بعد (مجلد بلا سكريبت)؛ بقيت الحلقة المفتوحة.");
  });
});
