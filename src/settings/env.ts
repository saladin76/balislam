import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config/paths";

/** المفاتيح التي يديرها الاستوديو. القيم السرية لا تُعرض أبدًا، بل آخر 4 أحرف فقط. */
export const MANAGED_KEYS = {
  ELEVENLABS_API_KEY: { secret: true, label: "مفتاح ElevenLabs" },
  ELEVENLABS_VOICE_ID: { secret: false, label: "معرّف الصوت" },
  ELEVENLABS_MODEL_ID: { secret: false, label: "نموذج الصوت (اختياري)" },
  QF_CLIENT_ID: { secret: true, label: "Quran Foundation Client ID" },
  QF_CLIENT_SECRET: { secret: true, label: "Quran Foundation Client Secret" },
  QF_ENV: { secret: false, label: "بيئة Quran Foundation" },
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
    if (!(k in MANAGED_KEYS) || raw === undefined) continue;
    const v = String(raw).trim().replace(/[\r\n]/g, "");
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, () => line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
  await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
};
