import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config/paths";

/** المفاتيح التي يديرها الاستوديو. القيم السرية لا تُعرض أبدًا، بل آخر 4 أحرف فقط. */
export const MANAGED_KEYS = {
  ELEVENLABS_API_KEY: { secret: true, label: "مفتاح ElevenLabs" },
  ELEVENLABS_VOICE_ID: { secret: false, label: "معرّف الصوت" },
  ELEVENLABS_MODEL_ID: { secret: false, label: "نموذج الصوت (اختياري)" },
} as const;

export type ManagedKey = keyof typeof MANAGED_KEYS;

export const envFile = () => process.env.BAL_ENV_FILE ?? path.join(projectRoot, ".env");

/** حالة المفاتيح دون كشف القيم السرية. */
export const keyStatus = () =>
  Object.fromEntries(
    (Object.keys(MANAGED_KEYS) as ManagedKey[]).map((k) => {
      const v = process.env[k] ?? "";
      const meta = MANAGED_KEYS[k];
      return [k, { label: meta.label, set: v.length > 0, preview: !v ? "" : meta.secret ? `••••${v.slice(-4)}` : v }];
    }),
  );

/**
 * يكتب المفاتيح في .env (يُنشئه من .env.example إن لم يوجد) ويحدّث البيئة الحالية فورًا.
 * قيمة فارغة تحذف المفتاح. الملف لا يُرفع إلى Git (في .gitignore).
 */
export const writeKeys = async (updates: Partial<Record<ManagedKey, string>>) => {
  const file = envFile();
  const example = path.join(projectRoot, ".env.example");
  let text = existsSync(file) ? await readFile(file, "utf8") : existsSync(example) ? await readFile(example, "utf8") : "";
  for (const [k, raw] of Object.entries(updates)) {
    if (!Object.hasOwn(MANAGED_KEYS, k) || raw === undefined) continue;
    const v = String(raw).trim().replace(/[\r\n]/g, "");
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, () => line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
  await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
};

/**
 * مفتاح توقيع سجل الاعتمادات المحلي: يُولَّد عشوائيًا مرة واحدة على جهاز صاحب القناة
 * وتُحفظ في .env (لا يُرفع)، حتى يعمل الاعتماد بلا إعداد يدوي. لا تُعرض ولا تُرسل للمتصفح أبدًا.
 * تغييرها لاحقًا يُبطل كل الاعتمادات الموقَّعة بالمفتاح القديم (عن قصد).
 */
export const LOCAL_SECRETS = ["BAL_WORKFLOW_HMAC_KEY"] as const;
export const ensureLocalSecrets = async (): Promise<string[]> => {
  const { randomBytes } = await import("node:crypto");
  const file = envFile();
  let text = existsSync(file) ? await readFile(file, "utf8") : "";
  const created: string[] = [];
  for (const k of LOCAL_SECRETS) {
    const m = text.match(new RegExp(`^${k}=(.*)$`, "m"));
    const current = (m?.[1] ?? process.env[k] ?? "").trim();
    if (current.length >= 32) {
      process.env[k] ??= current;
      continue;
    }
    const v = randomBytes(32).toString("hex");
    const line = `${k}=${v}`;
    text = m ? text.replace(new RegExp(`^${k}=.*$`, "m"), () => line) : `${text.replace(/\n*$/, text ? "\n" : "")}${line}\n`;
    process.env[k] = v;
    created.push(k);
  }
  if (created.length) {
    await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
    const { chmod } = await import("node:fs/promises");
    await chmod(file, 0o600); // الملف قد يكون موجودًا بصلاحيات أوسع
  }
  return created;
};

/**
 * كلمة مرور المالك: يختارها صاحب القناة بنفسه في الاستوديو، ويُحفظ في .env بصمتها فقط (SHA-256).
 * هي ما يثبت أن الاعتماد قرار بشري منه، فلا تُولَّد آليًا ولا تُكتب في أي ملف بنصها.
 * تغييرها يتطلب الكلمة الحالية، ويلغي كل جلسات المالك المفتوحة (D49).
 */
export const OWNER_PASSPHRASE_KEY = "BAL_STUDIO_OWNER_PASSPHRASE_SHA256";
export const setOwnerPassphrase = async (passphrase: unknown, current?: unknown): Promise<void> => {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v).digest("hex");
  if (typeof passphrase !== "string" || passphrase.length < 8 || passphrase.length > 200)
    throw new Error("كلمة مرور المالك من 8 أحرف على الأقل.");
  const existing = process.env[OWNER_PASSPHRASE_KEY]?.trim();
  if (existing && /^[a-f0-9]{64}$/.test(existing)) {
    if (typeof current !== "string" || !timingSafeEqual(Buffer.from(existing, "hex"), Buffer.from(digest(current), "hex")))
      throw new Error("كلمة المرور الحالية غير صحيحة.");
  }
  const file = envFile();
  let text = existsSync(file) ? await readFile(file, "utf8") : "";
  const line = `${OWNER_PASSPHRASE_KEY}=${digest(passphrase)}`;
  const re = new RegExp(`^${OWNER_PASSPHRASE_KEY}=.*$`, "m");
  text = re.test(text) ? text.replace(re, () => line) : `${text.replace(/\n*$/, text ? "\n" : "")}${line}\n`;
  await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
  const { chmod } = await import("node:fs/promises");
  await chmod(file, 0o600);
  process.env[OWNER_PASSPHRASE_KEY] = digest(passphrase);
  // كل جلسات المالك المفتوحة على أجهزته تُلغى بتغيير كلمة المرور (D49)؛ وربط كل جلسة ببصمة الكلمة يرفضها أصلًا.
  const { revokeAllOwnerSessions } = await import("../studio/ownerSessions");
  revokeAllOwnerSessions();
};
