declare const __STUDIO_PREVIEW__: boolean;
export const studioPreview = typeof __STUDIO_PREVIEW__ !== "undefined" && __STUDIO_PREVIEW__;
export const previewNotice = "نسخة معاينة للقراءة فقط. الحفظ والاعتماد والصوت والرندر متاحة في الاستوديو المحلي.";
export type PreviewRecord = { status: number; data: unknown };
export type PreviewSnapshot = { defaultChannel: string; records: Record<string, PreviewRecord> };

export const previewKey = (url: string, defaultChannel: string) => {
  const u = new URL(url, "https://studio.invalid");
  return `${u.searchParams.get("channel") || defaultChannel}:${u.pathname}`;
};

let snapshot: Promise<PreviewSnapshot> | undefined;
export async function readPreview<T>(url: string, method = "GET"): Promise<T> {
  if (method.toUpperCase() !== "GET") throw new Error(previewNotice);
  snapshot ??= fetch("/studio-preview.json").then(async (res) => {
    if (!res.ok) throw new Error("تعذّر تحميل بيانات المعاينة. أعد تحميل الصفحة.");
    return res.json() as Promise<PreviewSnapshot>;
  }).catch((error) => { snapshot = undefined; throw error; });
  const data = await snapshot;
  const record = data.records[previewKey(url, data.defaultChannel)];
  if (!record) throw new Error("هذه الخدمة تحتاج الاستوديو المحلي ولا تتوفر في نسخة المعاينة.");
  if (record.status !== 200) throw new Error((record.data as { error?: string }).error || "تعذّر عرض هذه البيانات في المعاينة.");
  return structuredClone(record.data) as T;
}

export const previewMediaUrl = (url: string) => {
  if (!studioPreview) return url;
  const u = new URL(url, "https://studio.invalid");
  return `/studio-preview-media/${encodeURIComponent(u.searchParams.get("channel") || "balislam")}${u.pathname.replace(/^\/api/, "")}`;
};
