import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelArt } from "../src/remotion/ChannelArt";
import { channelInfo, defaultChannel } from "../src/channel/types";
import { channelImageStyle, chatgptProjectInstructions, fireflyPrompt, fullImagePrompt, neutralImageStyle } from "../src/visual/prompts";

/** قناة غير معروفة لا تأخذ هوية قناة معتمدة (محراب «بالإسلام» أو أسلوب «دفاتر الزمن»). */
const unknown = { ...channelInfo(defaultChannel), id: "new-channel", name: "قناة جديدة", nameLatin: "NEW" };

describe("neutral fallbacks for an unknown channel", () => {
  it("channel art draws no mihrab, star ornament, seal or copper glow", () => {
    for (const kind of ["profile", "youtube"] as const) {
      const html = renderToStaticMarkup(<ChannelArt kind={kind} channel={unknown} />);
      for (const mark of ["#14382F", "#0F2A26", "pat-new-channel", "orn-l", "rgba(242,179,91"]) expect(html, mark).not.toContain(mark);
    }
    // the approved channel keeps its identity
    const own = renderToStaticMarkup(<ChannelArt kind="youtube" channel={{ ...unknown, id: "balislam" }} />);
    expect(own).toContain("#14382F");
  });

  it("image prompts use a neutral style and the safest people rule, never another channel's look", () => {
    const p = fullImagePrompt({ channel: "new-channel", prompt: "a quiet street at dawn" });
    expect(p).toContain(neutralImageStyle);
    for (const style of Object.values(channelImageStyle)) expect(p).not.toContain(style);
    expect(p).toContain("faces not visible");
    expect(fireflyPrompt({ channel: "new-channel", prompt: "a quiet street" }).prompt).toContain(neutralImageStyle);
    const gpt = chatgptProjectInstructions("new-channel");
    expect(gpt).not.toContain("medieval Islamic world");
    expect(gpt).toContain("Never depict any prophet");
    expect(gpt).toContain("No visible faces");
  });
});
