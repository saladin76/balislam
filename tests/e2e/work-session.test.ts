/**
 * «جلسة عمل» (D141) على خادم الاستوديو الحقيقي: الصفحة تضغط «ابدأ» ← العلم notes/work-session.json على studio-notes
 * في الأصل (bare مؤقت على القرص، لا GitHub) ← «أوقف» ← انتهاء الوقت ← طلب من موقع آخر 403. بلا صوت ولا رندر
 * (BAL_VOICE_PROVIDER=fake من الحزام)، ولا مفتاح.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { git, startStudio, waitFor, type Studio } from "./harness";

const FLAG = "notes/work-session.json";
let st: Studio;
let savedSync: string | undefined;
beforeAll(async () => {
  st = await startStudio("balislam");
  // الحزام يطفئ الإرسال؛ هنا يُطلب صراحة، والأصل مستودع على القرص وحده (notesSendPolicy).
  savedSync = process.env.BAL_NOTES_SYNC;
  process.env.BAL_NOTES_SYNC = "on";
});
afterAll(async () => {
  if (savedSync === undefined) delete process.env.BAL_NOTES_SYNC; else process.env.BAL_NOTES_SYNC = savedSync;
  await st?.close();
});

const flag = () => { try { return JSON.parse(git(st.remote, ["show", `refs/heads/studio-notes:${FLAG}`])); } catch { return null; } };

describe("جلسة عمل من رأس الاستوديو", () => {
  it("ابدأ ← العلم بـ until الصحيح؛ أوقف ← active=false؛ انتهاء الوقت؛ موقع آخر 403", async () => {
    const first = await st.call("GET", "notes/work-session");
    expect(first).toMatchObject({ status: 200, body: { session: null, live: false, hours: [1, 2, 3] } });

    // طلب من موقع آخر: 403 ولا شيء على الفرع
    const cross = await st.call("POST", "notes/work-session", { action: "start", hours: 2 }, { origin: "https://evil.example" });
    expect(cross.status).toBe(403);
    expect(flag()).toBeNull();
    expect((await st.call("POST", "notes/work-session", { action: "start", hours: 5 })).status).toBe(400);

    const before = Date.now();
    const started = await st.call("POST", "notes/work-session", { action: "start", hours: 2 });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    expect(started.body).toMatchObject({ live: true, push: { state: "sent" }, session: { active: true, channel: null } });
    const on = flag();
    expect(on).toEqual(started.body.session);
    expect(Object.keys(on)).toEqual(["active", "until", "startedAt", "channel"]);
    expect(Date.parse(on.until) - Date.parse(on.startedAt)).toBe(2 * 3_600_000);
    expect(Date.parse(on.startedAt)).toBeGreaterThanOrEqual(before - 1_000);
    // الفرع صناديق ملاحظات والعلم وحده؛ ولا شيء على main
    expect(git(st.remote, ["ls-tree", "-r", "--name-only", "refs/heads/studio-notes"])).toBe(FLAG);
    expect(git(st.root, ["status", "--porcelain", "--", "notes"])).toBe("");

    const stopped = await st.call("POST", "notes/work-session", { action: "stop" });
    expect(stopped.body).toMatchObject({ live: false, session: { active: false, until: on.until, startedAt: on.startedAt } });
    expect(flag()).toMatchObject({ active: false, until: on.until });

    // انتهاء الوقت: جلسة انتهى وقتها على هذا الجهاز تُكتب active=false عند أول قراءة
    await st.call("POST", "notes/work-session", { action: "start", hours: 1 });
    expect(flag()).toMatchObject({ active: true });
    const local = path.join(st.root, ".studio", "work-session.json");
    const state = JSON.parse(await readFile(local, "utf8"));
    state.session.until = new Date(Date.now() - 60_000).toISOString();
    await writeFile(local, JSON.stringify(state));
    expect((await st.call("GET", "notes/work-session")).body.live).toBe(false);
    await waitFor("expired flag on studio-notes", async () => flag(), (f) => f?.active === false && f.until === state.session.until, 60_000);
  });
});
