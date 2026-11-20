import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Owner, 19 Nov: «مشاهد معتمدة: …وحركته و...» with no «التفاصيل». The line was measured before the studio's face
// loaded; the face widened the text without resizing the box, so the ResizeObserver never fired.
describe("D74: «التفاصيل» appears whenever the dock line is cut, also after the fonts load", () => {
  it("measures again when the faces are ready and when one finishes loading", () => {
    const s = readFileSync(path.join(import.meta.dirname, "..", "app/src/shell/DockText.tsx"), "utf8");
    expect(s).toContain("fonts?.ready.then(() => { if (alive) check(); })");
    expect(s).toContain('fonts?.addEventListener?.("loadingdone", check)');
    expect(s).toContain('fonts?.removeEventListener?.("loadingdone", check)');
  });
});
