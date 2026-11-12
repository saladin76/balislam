> أرشيف — السلوك الحالي في studio-map.md

# Studio vNext — single-operator production workflow (candidate; implementation in progress)

**Owner-approved architecture**: [decision](https://github.com/saladin76/balislam/pull/78#issuecomment-6711912819), [human Quran audio](https://github.com/saladin76/balislam/pull/78#issuecomment-6711939617).

This file describes the target interface; it does **not** claim the active Studio UI or renderer already implements the target. Never automatically migrate old workflow signoffs to new per-scene approvals.

## Five visible steps (no technical security fields on main screen)

| User-visible step | Internal data and operation |
|---|---|
| 1. إعداد الحلقة | فكرة ومرجع، السكريبت، مراجعة وتدقيق، تثبيت النص، تشكيله، اقتراح النبرة |
| 2. Storyboard | PDF شامل عدد المشاهد والكاميرا/الإضاءة/التكوين 16:9، وتخطيط 9:16 إذا كانت النسخة الرأسية من المخرجات المطلوبة؛ اعتماد صريح |
| 3. إنتاج المشاهد | مشهد واحد نشط: صوت الراوي أولًا، زمن الصوت الحقيقي، رسم/حركة، فيديو AV واحد، ملاحظات، تصحيح واعتماد، ثم التالي |
| 4. مراجعة الحلقة | دمج المشاهد المعتمدة، مشاهدة كاملة بسرعة 1× وتقييم الانتقالات والتزامن والصوت **واعتماد التجميع**؛ ثم مشاهدة Master الفعلي و**اعتماده منفصلًا** حسب البصمة |
| 5. النشر | ملف Master المعتمد بالبايتات نفسها فقط؛ حقوق التلاوات والتصاريح والمصادقة وإعادة الفحص عند الإرسال |

**UI principles:** single user; automatic safe defaults; one primary button («متابعة»); stage status only: جاهز/قيد العمل/يحتاج تعديل/معتمد. Hide SHA, ledger, CI, worker roles and technical safety controls in an optional diagnostics drawer. No repeated codes to accept ordinary review decisions. Sensitive publish remains explicitly confirmed and authenticated by server.

## Uploaded Quran audio

- القرآن النصي من `script.md` فقط. يبقى التدقيق الشرعي/مقارنة المصحف **مهمة بشرية مستقلة**؛ لا تأليف ولا إصلاح آلي لآية.
- صاحب المشروع يرسل تسجيل التلاوة البشري إلى Claude ثم يضيفه إلى الحلقة المحددة. New CLI candidate:
  - `npx bal --channel <channel> recitation-attach <episode> <ayah-key> <local-file>`
  - `npx bal --channel <channel> recitation-review <episode> <ayah-key> --reciter <human-name> --rights-evidence <evidence> --reviewer <name> --note <note> --listened`
- `recitation-attach` means **pending review**, NOT approved for playback or publishing. Human must actually listen and check reference/text/hash/reciter/rights; approving the recording does **not** approve the whole AV scene.
- Never synthesize Quran; never fetch another provider; never silently substitute `assets/recitations`. A missing or invalid manual file blocks final production.
- Recorded source audio stays in the episode's `recitations/` and must be reverified at collection, staged render, queue execution/recovery, final output and publication.

## New policy foundation (not a real gate yet)

`src/studio/sceneProduction.ts` models separate approvals for script and Storyboard; ordered scene previews+AV signoff; preserving unaffected scene approvals; invalidation of assembly/Master when scene edits; final Master SHA. `tests/studio-scene-production.test.ts` and `tests/studio-owner-supplied-quran.test.ts` provide **unexecuted** regression suites on this Draft.

To implement production-ready:
1. Persist signed, append-only, per-scene ledger and artifact generation/epoch under a trusted single-user server session and shared writer lock.
2. Bind real source/voice/preview files to SHA-256 on every read/action; never trust client-provided hashes, role, approval flag or event timestamp. The pure module only models states.
3. Reject next scene until current composite AV scene explicitly approved. Precomputation of unapproved assets is allowed, final production is not.
4. Implement screen with exact current scene's video player, time-stamped comments, correction/retry, single human approval, and progress. Preserve drafts/navigation.
5. Merge only real approved scene media; watch final assembled video at 1×. Render and approve exact Master bytes, with immutable copy/dispatch protections.
6. Resolve the old six-stage schema, old provider compatibility fields, web API and renderer branches in isolated PR #78; never auto-convert older approvals.

## Safety and migration

- Draft only; no `main` merge, no Vercel/production deploy, no real-episode render, no automatic decisions.
- Retire old provider source code, tests and active docs **before** claiming no traces. Existing historical episode review/audit documents must remain truthful; if preserving them, label them archives rather than modifying their factual history.
- Old `.env` credentials on the user's Mac are **not** modified by changing `.env.example`; remove only with deliberate local review of the actual configuration after the final migration.
- Run TypeScript/Vitest/security+three-channel parity/Chrome/FFmpeg/Remotion and real scene AV checks on exact pinned integration SHA; fix failures, then request user merge authorization.
