#!/bin/sh
# تسليم ملفات ستوري بورد إلى Google Drive بالناقل الموثق على الـMac (الأمر 018).
# يُشغَّل على جهاز صاحب المشروع وحده (يحتاج studio-handoff.sh ومفاتيحه؛ لا مفاتيح هنا).
#
#   sh scripts/handoff-storyboard.sh <commit> <channel> <episode> <list-path>
#
# list-path: ملف داخل الـcommit، سطر لكل ملف: slot<TAB>path<TAB>sha256<TAB>md5 (path نسبي لمجلد الحلقة).
# كل ملف يُستخرج من الـcommit نفسه (بايتات ثابتة، لا ملفات العمل)، وتُطابق بصمته SHA256 وMD5 القائمة
# قبل الرفع، ثم يُشترط في رد الناقل VERIFIED وLINK https://. لا يحذف شيئًا ولا يغيّر المستودع.
# الخروج 0 فقط إذا تحقق كل ملف. النتائج في ملف TSV يُطبع مساره في الآخر.
set -eu
[ $# -eq 4 ] || { echo "الاستعمال: sh $0 <commit> <channel> <episode> <list-path>" >&2; exit 2; }
COMMIT=$1; CHANNEL=$2; EPISODE=$3; LIST=$4
UPLOADER=${HANDOFF_UPLOADER:-"$HOME/Balislam-Preview-Sync/studio-handoff.sh"}
[ -x "$UPLOADER" ] || { echo "الناقل غير موجود أو غير قابل للتشغيل: $UPLOADER" >&2; exit 2; }
git cat-file -e "$COMMIT^{commit}" 2>/dev/null || { echo "الـcommit غير موجود محليًا: $COMMIT (نفّذ git fetch أولًا)" >&2; exit 2; }
EP="channels/$CHANNEL/episodes/$EPISODE"
sha() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi; }
md5f() { if command -v md5 >/dev/null 2>&1; then md5 -q "$1"; else md5sum "$1" | cut -d' ' -f1; fi; }
TMP=$(mktemp -d "${TMPDIR:-/tmp}/handoff-storyboard.XXXXXX")
OUTDIR="$HOME/Balislam-Preview-Sync/handoff-results"; mkdir -p "$OUTDIR"
RESULTS="$OUTDIR/$CHANNEL-$EPISODE-$(date +%Y%m%d-%H%M%S).tsv"
printf 'slot\tfile\tsha256\tmd5\tresult\tlink\n' > "$RESULTS"
FAIL=0
git show "$COMMIT:$LIST" > "$TMP/list.tsv"
TAB=$(printf '\t')
while IFS="$TAB" read -r SLOT REL WANT_SHA WANT_MD5; do
  [ -n "$SLOT" ] || continue
  case "$SLOT" in \#*) continue ;; esac
  F="$TMP/$(basename "$REL")"
  if ! git show "$COMMIT:$EP/$REL" > "$F" 2>/dev/null; then echo "✗ $SLOT: الملف غير موجود في الـcommit ($REL)"; printf '%s\t%s\t\t\tMISSING\t\n' "$SLOT" "$REL" >> "$RESULTS"; FAIL=1; continue; fi
  GOT_SHA=$(sha "$F"); GOT_MD5=$(md5f "$F")
  if [ "$GOT_SHA" != "$WANT_SHA" ] || [ "$GOT_MD5" != "$WANT_MD5" ]; then echo "✗ $SLOT: البصمة لا تطابق القائمة"; printf '%s\t%s\t%s\t%s\tCHECKSUM_MISMATCH\t\n' "$SLOT" "$REL" "$GOT_SHA" "$GOT_MD5" >> "$RESULTS"; FAIL=1; continue; fi
  OUT=$("$UPLOADER" upload --kind storyboard --file "$F" --channel "$CHANNEL" --episode "$EPISODE" --slot "$SLOT" 2>&1) || true
  LINK=$(printf '%s\n' "$OUT" | sed -n 's/^LINK \(https:[^ ]*\).*/\1/p' | head -1)
  if printf '%s\n' "$OUT" | grep -q '^VERIFIED ' && [ -n "$LINK" ]; then
    echo "✓ $SLOT  $LINK"; printf '%s\t%s\t%s\t%s\tVERIFIED\t%s\n' "$SLOT" "$REL" "$GOT_SHA" "$GOT_MD5" "$LINK" >> "$RESULTS"
  else
    echo "✗ $SLOT: الناقل لم يؤكد الرفع"; printf '%s\n' "$OUT" | tail -5; printf '%s\t%s\t%s\t%s\tUPLOAD_FAILED\t\n' "$SLOT" "$REL" "$GOT_SHA" "$GOT_MD5" >> "$RESULTS"; FAIL=1
  fi
done < "$TMP/list.tsv"
rm -rf "$TMP"
echo "النتائج: $RESULTS"
[ "$FAIL" -eq 0 ] && echo "HANDOFF_OK (الحالة PENDING_REVIEW؛ الرفع ليس اعتمادًا)" || { echo "HANDOFF_INCOMPLETE" >&2; exit 1; }
