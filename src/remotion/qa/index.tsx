import React from "react";
import { Composition, registerRoot } from "remotion";
import { FramingTiming, FRAMING_CASES } from "../lab/FramingLab";
import { Providers } from "../Providers";

/** Opt-in diagnostic entrypoint. Nothing is registered in the production RemotionRoot. */
const MotionFixture: React.FC<{ fit: boolean; orientation: "landscape" | "portrait"; caseId: string }> = (props) => (
  <Providers>
    <FramingTiming {...props} />
  </Providers>
);

const ITEMS = ["witnesses", "companion", "solo-door", "board", "stillness"] as const;
const QA: React.FC = () => (
  <>
    {ITEMS.flatMap((id) => {
      const found = FRAMING_CASES.find((c) => c.id === id)!;
      return (["landscape", "portrait"] as const).flatMap((orientation) => ([false, true] as const).map((fit) => (
        <Composition
          key={`${id}-${orientation}-${fit}`}
          id={`motion-qa-${id}-${orientation}-${fit ? "fit" : "baseline"}`}
          component={MotionFixture}
          defaultProps={{ caseId: id, orientation, fit }}
          durationInFrames={found.seconds * 30}
          fps={30}
          width={orientation === "landscape" ? 1920 : 1080}
          height={orientation === "landscape" ? 1080 : 1920}
        />
      )));
    })}
  </>
);

registerRoot(QA);
