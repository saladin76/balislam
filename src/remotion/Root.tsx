import React from "react";
import { Composition, Still } from "remotion";
import { themeIds } from "../../brand/themes";
import { BrandSheet } from "./BrandSheet";
import { TemplateReel, reelDuration } from "./scenes/TemplateReel";
import { sceneCatalog } from "./scenes/catalog";
import { sampleForChannel } from "./scenes/channelSamples";
import { Thumbnail } from "./Thumbnail";
import { ChannelArt, artSizes, type ArtKind } from "./ChannelArt";
import { SilhouetteDemo } from "./styles/Silhouette";
import { FlatModernDemo } from "./styles/FlatModern";
import { PaperCutDemo } from "./styles/PaperCut";
import { IsometricDemo } from "./styles/Isometric";
import { Providers } from "./Providers";
import config from "../../config.json";
import { Episode, calculateEpisodeMetadata, type EpisodeProps } from "./scenes/Episode";
import { CameraAB, CameraComposedPortrait } from "./lab/BalislamLab";
import { MOTION_SEGMENTS, MotionLab, SEG } from "./lab/MotionLab";
import { MotionLab007, MotionScenes007, SEG7, SEGMENTS_007 } from "./lab/MotionLab007";
import { ReviewReel014, review014Frames } from "./lab/ReviewReel014";
import { WitnessesLab015, WITNESSES_015 } from "./lab/WitnessesLab015";
import { FramingLab, FramingTiming, framingLabFrames } from "./lab/FramingLab";
import { PermanentCh2, PermanentStyles, permanentCh2Frames, permanentStylesFrames } from "./lab/PermanentLab";
import { TransitionLab, TransitionLabBaseline, transitionLabFrames } from "./lab/TransitionLab";
import { LIGHT_CASES, LIGHT_CASES_009, LightTimingOff, LightTimingOn, lightLab, lightLab009 } from "./lab/LightLab";
import { AlleyTale } from "./scenes/AlleyTale";
import samplePlan from "../../tests/fixtures/plan.json";
import { ChannelIntro, type IntroKind } from "./scenes/ChannelIntro";
import { HorizonAudioReel, HorizonTest, HZ_FPS, HZ_TOTAL, horizonAudioMetadata } from "./dafatir/horizon/HorizonTest";
import { MIHRAB_FRAMES } from "./scenes/MihrabIntro";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";

/** نماذج أساليب بديلة (أساس اقتراحات الستوري بورد قبل اعتماد أسلوب الحلقة). */
const styleDemos = { silhouette: SilhouetteDemo, "flat-modern": FlatModernDemo, "paper-cut": PaperCutDemo, isometric: IsometricDemo } as const;

/** افتتاحية قناة منفردة (للمعاينة): تُمرَّر هوية القناة واسمها من inputProps */
const IntroPreview: React.FC<{ kind: IntroKind; orientation: "landscape" | "portrait"; identity?: Identity; channel?: ChannelInfo }> = ({ kind, orientation, identity, channel }) => (
  <Providers identity={identity} channel={channel}>
    <ChannelIntro kind={kind} orientation={orientation} />
  </Providers>
);

/** معاينة قالب بلغة من اليسار لليمين (للتحقق من الاتجاه قبل إطلاق قناة تركية أو إنجليزية). */
const LtrPreview: React.FC<{ entryId: string; lang: string } & Record<string, unknown>> = ({ entryId, lang, ...props }) => {
  const entry = sceneCatalog.find((e) => e.id === entryId)!;
  const C = entry.component;
  return (
    <Providers lang={lang}>
      <C {...props} />
    </Providers>
  );
};

/** معاينة أي قالب بهوية قناة محددة (تُمرَّر الهوية والقناة من inputProps). */
const ChannelScenePreview: React.FC<{ entryId: string; identity?: Identity; channel?: ChannelInfo } & Record<string, unknown>> = ({ entryId, identity, channel, ...props }) => {
  const entry = sceneCatalog.find((e) => e.id === entryId)!;
  const C = entry.component;
  return (
    <Providers identity={identity} channel={channel}>
      <C {...sampleForChannel(channel?.id, entryId, entry.sample)} {...props} />
    </Providers>
  );
};

const sizes = {
  landscape: { width: config.video.episode.width, height: config.video.episode.height },
  portrait: { width: config.video.short.width, height: config.video.short.height },
} as const;
const orientations = ["landscape", "portrait"] as const;

/** كل التكوينات المسجلة في Remotion: لوحات الهوية، القوالب، الحلقة والشورت، الصورة المصغّرة، والافتتاحية. */
export const RemotionRoot: React.FC = () => (
  <>
    {/* دفاتر الزمن 001: اختبار «خط الأفق» — مشاهد غير قرآنية، معاينة صامتة لا تُنشر */}
    <Composition id="dafatir-001-horizon-test" component={HorizonTest} durationInFrames={HZ_TOTAL} fps={HZ_FPS} width={1920} height={1080} />
    {/* دفاتر الزمن 001: اللقطات الست بصوت الراوي والتلاوة — تُرندر على جهاز الإنتاج فقط (npx bal horizon-audio) */}
    <Composition id="dafatir-001-horizon-audio" component={HorizonAudioReel} defaultProps={{}} calculateMetadata={horizonAudioMetadata} durationInFrames={HZ_TOTAL} fps={HZ_FPS} width={1920} height={1080} />
    {/* مختبر «بالإسلام»: اختبارات بصرية للمحرك، بلا صوت، لا تُنشر */}
    <Composition id="balislam-lab-camera-ab" component={CameraAB} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    <Composition id="balislam-lab-motion" component={MotionLab} durationInFrames={MOTION_SEGMENTS.length * SEG} fps={config.video.fps} {...sizes.landscape} />
    <Composition id="balislam-lab-motion-007" component={MotionLab007} durationInFrames={SEGMENTS_007.length * SEG7} fps={config.video.fps} {...sizes.landscape} />
    <Composition id="balislam-lab-motion-scenes" component={MotionScenes007} durationInFrames={14 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    {LIGHT_CASES.map((c) => (
      <Composition key={c.id} id={`balislam-lab-light-${c.id}`} component={lightLab(c.id)} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    ))}
    {LIGHT_CASES_009.map((c) => (
      <Composition key={c.id} id={`balislam-lab-light9-${c.id}`} component={lightLab009(c.id)} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    ))}
    <Composition id="balislam-lab-light-timing-off" component={LightTimingOff} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    <Composition id="balislam-lab-light-timing-on" component={LightTimingOn} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
    <Composition id="balislam-lab-camera-portrait" component={CameraComposedPortrait} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes.portrait} />

    {/* Controlled A/B comparison: same words, cast and timing; only camera direction differs. */}
    {(["automatic", "directed"] as const).map((mode) => (
      <Composition
        key={mode}
        id={`balislam-alley-${mode}-review`}
        component={AlleyTale}
        durationInFrames={10 * config.video.fps}
        fps={config.video.fps}
        {...sizes.landscape}
        defaultProps={{
          themeId: "night" as const,
          orientation: "landscape" as const,
          narration: "قد تصدق خبرًا لأنه يؤكد رأيك. ثم تفكر في الحقيقة.",
          place: "alley",
          mood: "night",
          cast: "solo",
          poses: "stand",
          cues: "news | خبرًا\ntruth | الحقيقة",
          cameraMode: mode,
          camera: mode === "directed" ? "still" : "push",
        }}
      />
    ))}

    {(["paper", "night"] as const).flatMap((id) =>
      orientations.flatMap((o) =>
        sceneCatalog.map((entry) => (
          <Composition
            key={`en-${entry.id}-${id}-${o}`}
            id={`en-scene-${entry.id}-${id}-${o}`}
            component={LtrPreview}
            durationInFrames={Math.round(entry.seconds * config.video.fps)}
            fps={config.video.fps}
            {...sizes[o]}
            defaultProps={{ ...(entry.sampleEn ?? entry.sample), themeId: id, orientation: o, entryId: entry.id, lang: "en" }}
          />
        )),
      ),
    )}
    {orientations.map((o) => (
      <Composition key={`chscene-${o}`} id={`channel-scene-${o}`} component={ChannelScenePreview} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes[o]} defaultProps={{ entryId: "motion-story", themeId: "night" as const, orientation: o }} />
    ))}
    {orientations.map((o) => (
      <Composition key={`intro-${o}`} id={`channel-intro-${o}`} component={IntroPreview} durationInFrames={MIHRAB_FRAMES} fps={config.video.fps} {...sizes[o]} defaultProps={{ kind: "mihrab" as IntroKind, orientation: o }} />
    ))}
    {(Object.keys(artSizes) as ArtKind[]).map((k) => (
      <Still key={`art-${k}`} id={`channel-art-${k}`} component={ChannelArt} {...artSizes[k]} defaultProps={{ kind: k }} />
    ))}
      {/* نماذج الأساليب البصرية لدفاتر الزمن (للمقارنة قبل اعتماد أسلوب) */}
      {Object.entries(styleDemos).map(([id, C]) => (
        <Composition key={`style-${id}`} id={`style-${id}`} component={C} durationInFrames={9 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
      ))}
    <Still id="thumbnail-en" component={Thumbnail} width={1280} height={720} defaultProps={{ themeId: "paper" as const, title: "Why do we put off what matters?", highlight: "what matters?", element: "hourglass-patience", lang: "en" }} />
    <Still id="thumbnail" component={Thumbnail} width={1280} height={720} defaultProps={{ themeId: "paper" as const, title: "لماذا نؤجّل ما نعرف أنه مهم؟", highlight: "نعرف أنه مهم", element: "hourglass-patience" }} />
    {/* نسخة المراجعة البصرية (الأمر 014): بملء الإطار، بلا صوت، ولا تُنشر */}
    <Composition id="review-014-landscape" component={ReviewReel014} durationInFrames={review014Frames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "landscape" as const }} />
    <Composition id="review-014-portrait" component={ReviewReel014} durationInFrames={review014Frames()} fps={config.video.fps} {...sizes.portrait} defaultProps={{ orientation: "portrait" as const }} />
    <Composition id="lab-witnesses-015-landscape" component={WitnessesLab015} durationInFrames={WITNESSES_015.seconds * config.video.fps} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "landscape" as const }} />
    <Composition id="lab-witnesses-015-portrait" component={WitnessesLab015} durationInFrames={WITNESSES_015.seconds * config.video.fps} fps={config.video.fps} {...sizes.portrait} defaultProps={{ orientation: "portrait" as const }} />
    {/* مختبر التأطير (الأمر 013): قبل/بعد framing = fit، بلا صوت، ولا يُنشر */}
    <Composition id="lab-framing-landscape" component={FramingLab} durationInFrames={framingLabFrames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "landscape" as const }} />
    {(["landscape", "portrait"] as const).map((o) => (
      <Composition key={`motion013-${o}`} id={`lab-motion-013-${o}`} component={PermanentStyles} durationInFrames={permanentStylesFrames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: o, footer: "مختبر المحرك · الأمر 013 · المشهد نفسه بالتوقيت نفسه · بلا صوت · لا يُنشر" }} />
    ))}
    {[false, true].map((fit) => (
      <Composition key={`ftime-${fit}`} id={`lab-framing-timing-${fit ? "fit" : "base"}`} component={FramingTiming} durationInFrames={8 * config.video.fps} fps={config.video.fps} {...sizes.portrait} defaultProps={{ fit, orientation: "portrait" as const, caseId: "witnesses" }} />
    ))}
    <Composition id="lab-framing-portrait" component={FramingLab} durationInFrames={framingLabFrames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "portrait" as const }} />
    {/* مختبر التوجيه الدائم: الحلقة الجديدة بأدوات المحرك المعتمدة، بلا صوت، ولا يُنشر */}
    <Composition id="lab-permanent-ch2-landscape" component={PermanentCh2} durationInFrames={permanentCh2Frames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "landscape" as const }} />
    <Composition id="lab-permanent-ch2-portrait" component={PermanentCh2} durationInFrames={permanentCh2Frames()} fps={config.video.fps} {...sizes.landscape} defaultProps={{ orientation: "portrait" as const }} />
    <Composition id="lab-permanent-styles" component={PermanentStyles} durationInFrames={permanentStylesFrames()} fps={config.video.fps} {...sizes.landscape} />
    {/* مختبر الانتقالات (الأمر 011): بلا صوت، ولا يُنشر */}
    {orientations.map((o) => (
      <React.Fragment key={`tlab-${o}`}>
        <Composition id={`lab-transitions-${o}`} component={TransitionLab} durationInFrames={transitionLabFrames()} fps={config.video.fps} {...sizes[o]} defaultProps={{ orientation: o }} />
        <Composition id={`lab-transitions-baseline-${o}`} component={TransitionLabBaseline} durationInFrames={transitionLabFrames()} fps={config.video.fps} {...sizes[o]} defaultProps={{ orientation: o }} />
      </React.Fragment>
    ))}
    {orientations.map((o) => (
      <Composition
        key={`episode-${o}`}
        id={`episode-${o}`}
        component={Episode}
        durationInFrames={300}
        fps={config.video.fps}
        {...sizes[o]}
        defaultProps={{ plan: samplePlan as unknown as EpisodeProps["plan"], orientation: o } as EpisodeProps}
        calculateMetadata={calculateEpisodeMetadata}
      />
    ))}
    {themeIds.map((id) => (
      <React.Fragment key={id}>
        <Still id={`brand-${id}-landscape`} component={BrandSheet} {...sizes.landscape} defaultProps={{ themeId: id, orientation: "landscape" as const }} />
        <Still id={`brand-${id}-portrait`} component={BrandSheet} {...sizes.portrait} defaultProps={{ themeId: id, orientation: "portrait" as const }} />
        {orientations.map((o) => (
          <React.Fragment key={o}>
            <Composition id={`reel-${id}-${o}`} component={TemplateReel} durationInFrames={reelDuration} fps={config.video.fps} {...sizes[o]} defaultProps={{ themeId: id, orientation: o }} />
            {sceneCatalog.map((entry) => (
              <Composition
                key={entry.id}
                id={`scene-${entry.id}-${id}-${o}`}
                component={entry.component}
                durationInFrames={Math.round(entry.seconds * config.video.fps)}
                fps={config.video.fps}
                {...sizes[o]}
                defaultProps={{ ...entry.sample, themeId: id, orientation: o }}
              />
            ))}
          </React.Fragment>
        ))}
      </React.Fragment>
    ))}
  </>
);
