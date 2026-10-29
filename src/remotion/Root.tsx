import React from "react";
import { Still } from "remotion";
import { themeIds } from "../../brand/themes";
import { BrandSheet } from "./BrandSheet";
import config from "../../config.json";

/** كل التكوينات المسجلة في Remotion. الحلقة والشورت تُضافان في المرحلة 5. */
export const RemotionRoot: React.FC = () => (
  <>
    {themeIds.map((id) => (
      <React.Fragment key={id}>
        <Still
          id={`brand-${id}-landscape`}
          component={BrandSheet}
          width={config.video.episode.width}
          height={config.video.episode.height}
          defaultProps={{ themeId: id, orientation: "landscape" as const }}
        />
        <Still
          id={`brand-${id}-portrait`}
          component={BrandSheet}
          width={config.video.short.width}
          height={config.video.short.height}
          defaultProps={{ themeId: id, orientation: "portrait" as const }}
        />
      </React.Fragment>
    ))}
  </>
);
