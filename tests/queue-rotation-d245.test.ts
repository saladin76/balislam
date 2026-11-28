import { describe, expect, it } from "vitest";
import { channelAfter, noteClaim, orderJobs, queueSummary, type RotationState } from "../src/render/worker/rotation";
import { jobPriority } from "../src/render/worker/protocol";

/** D245: طابور الويندوز بالتناوب بين القنوات، والحلقة الجارية حتى تنتهي، وMaster لا يتأخر، وتسجيل الأدوار المتخطّاة */
const j = (channel: string, episode: string, kind: string, createdAt: string, id = `${channel}-${episode}-${kind}-${createdAt}`) => ({ channel, episode, kind, createdAt, id });
const ids = (xs: { channel: string; episode: string; kind: string }[]) => xs.map((x) => `${x.channel.slice(0, 3)}${x.episode}:${x.kind}`);
const empty: RotationState = { version: 1, current: null, log: [] };

describe("D245: التناوب", () => {
  it("الترتيب الدائري: دفاتر الزمن ← زبدة الكتب ← بالإسلام ← دفاتر الزمن", () => {
    expect(channelAfter(null)).toBe("dafatir-alzaman");
    expect(channelAfter("dafatir-alzaman")).toBe("zubdat-alkutub");
    expect(channelAfter("zubdat-alkutub")).toBe("balislam");
    expect(channelAfter("balislam")).toBe("dafatir-alzaman");
  });

  it("الحلقة الجارية تكمل كل مشتملاتها قبل أن تبدأ حلقة قناة أخرى أقدم منها", () => {
    const jobs = [j("zubdat-alkutub", "001", "scene", "2026-11-28T01:00"), j("dafatir-alzaman", "002", "scene", "2026-11-28T02:00"), j("dafatir-alzaman", "002", "assembly", "2026-11-28T03:00")];
    expect(ids(orderJobs(jobs, { channel: "dafatir-alzaman", episode: "002" }, jobPriority))).toEqual(["daf002:scene", "daf002:assembly", "zub001:scene"]);
  });

  it("بعد انتهاء الحلقة الجارية: القناة التي عليها الدور أولًا، لا الأقدم", () => {
    const jobs = [j("dafatir-alzaman", "006", "scene", "2026-11-28T01:00"), j("balislam", "002", "scene", "2026-11-28T01:30"), j("zubdat-alkutub", "001", "scene", "2026-11-28T02:00")];
    expect(ids(orderJobs(jobs, { channel: "dafatir-alzaman", episode: "002" }, jobPriority))).toEqual(["zub001:scene", "bal002:scene", "daf006:scene"]);
  });

  it("القناة التي عليها الدور بلا حلقة: تُؤخذ التالية، ويُسجَّل التخطّي", () => {
    const jobs = [j("dafatir-alzaman", "006", "scene", "2026-11-28T01:00")];
    const cur = { channel: "dafatir-alzaman", episode: "002" };
    expect(ids(orderJobs(jobs, cur, jobPriority))).toEqual(["daf006:scene"]);
    const s = noteClaim({ ...empty, current: { ...cur, since: "x" } }, { channel: "dafatir-alzaman", episode: "006" }, new Date("2026-11-28T05:00:00Z"));
    expect(s.current).toMatchObject({ channel: "dafatir-alzaman", episode: "006" });
    expect(s.log.at(-1)).toMatchObject({ expected: "zubdat-alkutub", skipped: ["zubdat-alkutub", "balislam"] });
  });

  it("مهمة من الحلقة الجارية نفسها لا تغيّر الحالة ولا تُسجَّل", () => {
    const s: RotationState = { ...empty, current: { channel: "balislam", episode: "003", since: "x" } };
    expect(noteClaim(s, { channel: "balislam", episode: "003" }, new Date())).toBe(s);
  });

  it("Master لا يتأخر: طبقة الأولوية (D243) فوق التناوب، والعمودية بعد كل شيء", () => {
    const jobs = [j("zubdat-alkutub", "001", "vertical", "2026-11-28T00:00"), j("dafatir-alzaman", "002", "scene", "2026-11-28T01:00"), j("balislam", "002", "master", "2026-11-28T02:00")];
    const out = ids(orderJobs(jobs, { channel: "dafatir-alzaman", episode: "002" }, jobPriority));
    expect(out.at(-1)).toBe("zub001:vertical");
    expect(out).toContain("bal002:master");
  });

  it("ملخص الطابور بالحلقة: التالي وبعده والدور", () => {
    const pend = [j("dafatir-alzaman", "002", "scene", "2026-11-28T01:00"), j("dafatir-alzaman", "006", "scene", "2026-11-28T02:00")];
    expect(queueSummary([], pend, { channel: "dafatir-alzaman", episode: "002" }, jobPriority)).toMatchObject({ next: "dafatir-alzaman/002", after: "dafatir-alzaman/006", turn: "zubdat-alkutub" });
  });
});
