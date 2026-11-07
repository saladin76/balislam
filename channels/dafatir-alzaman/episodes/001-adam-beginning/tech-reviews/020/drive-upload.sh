#!/usr/bin/env bash
# تسليم ستوري بورد الحلقة 001 (الأمر 020، ومسودات الأمر 022، وخريطة الأداء 023–025) إلى Google Drive بأداة الرفع الموثقة — يُشغَّل على جهاز صاحب المشروع فقط.
# الاستعمال، من نسخة فرع PR #47 (التي فيها scripts/studio-preview-cloud.py):
#   bash <main>/channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/drive-upload.sh <main>
# <main> = مسار نسخة main المحدثة. لا يحذف شيئًا ولا ينشر؛ يرفع ويتحقق (md5) ويكتب سجلًا.
# السجل drive-upload.log بجوار هذا الملف: لكل ملف بصمته SHA256 محليًا ونتيجة الأداة (VERIFIED والرابط) أو الخطأ.
# «VERIFIED» وصول سليم، لا اعتماد. أعِد السجل إلى المنفّذ ليطابق البصمات بملف JSON ويسجّل الروابط.
set -u
MAIN="${1:?مسار نسخة main مطلوب}"
EP="$MAIN/channels/dafatir-alzaman/episodes/001-adam-beginning"
DIR="$EP/tech-reviews/020"
UP="scripts/studio-preview-cloud.py"
LOG="$DIR/drive-upload.log"
[ -f "$UP" ] || { echo "شغّله من نسخة فرع PR #47: $UP غير موجود" >&2; exit 1; }
: > "$LOG"
up() { # kind slot file
  local sum; sum=$(shasum -a 256 "$3" | cut -d' ' -f1)
  { echo "== $2 ($1) $(basename "$3") sha256=$sum"; python3 "$UP" upload --kind "$1" --channel dafatir-alzaman --episode 001-adam-beginning --slot "$2" --file "$3" 2>&1; echo "exit=$?"; } | tee -a "$LOG"
}
up storyboard storyboard-v1.1 "$DIR/docs/storyboard-001-v1.1.pdf"
up storyboard storyboard-v1.1 "$DIR/docs/storyboard-001-v1.1.json"
for f in "$DIR"/strips/sb*.jpg; do up storyboard "$(basename "$f" .jpg)" "$f"; done
up video v7-u9-silent-reference "$EP/previews/episode.mp4"
# الأمر 022: مسودات اللوحات المتأثرة وقياس c7-s4 (غير معتمدة)
for f in "$EP"/tech-reviews/022/strips/*.jpg; do up storyboard "o022-$(basename "$f" .jpg)" "$f"; done
# الأمر 023: خريطة الأداء الصوتي (مسودة غير معتمدة)
up storyboard tone-map-v1 "$EP/tech-reviews/023/docs/tone-map-001-v1.pdf"
up storyboard tone-map-v1 "$EP/tech-reviews/023/docs/tone-map-001-v1.json"
# الأمر 024: خريطة الأداء v1.1 (قرارات D1–D9، تصحيحات تشكيل معدّة غير مطبقة)
up storyboard tone-map-v1.1 "$EP/tech-reviews/024/docs/tone-map-001-v1.1.pdf"
up storyboard tone-map-v1.1 "$EP/tech-reviews/024/docs/tone-map-001-v1.1.json"
# الأمر 025: خريطة النبرة v1.2 ولوحة الصمت والأجزاء
up storyboard tone-map-v1.2 "$EP/tech-reviews/025/docs/tone-map-001-v1.2.json"
up storyboard o025-silence-and-parts "$EP/tech-reviews/025/strips/silence-and-parts.jpg"
echo "VERIFIED: $(grep -c '^VERIFIED' "$LOG") · أخطاء: $(grep -c '^exit=[1-9]' "$LOG") · السجل: $LOG"
