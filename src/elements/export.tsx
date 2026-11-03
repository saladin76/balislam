import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildThemes, themeIds, type Theme, type ThemeId } from "../../brand/themes";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import { Element } from "../../brand/elements/Element";
import { elementLibrary } from "../../brand/elements/registry";
import { categoryNamesAr, categoryOrder } from "../../brand/elements/types";
import { Character, characterNamesAr, characterPoses, characterVariants, characterPoseNamesAr } from "../../characters/Character";
import { LogoMark } from "../../brand/logo/Logo";
import { sfxLibrary, sfxCategoryNamesAr } from "../../brand/sfx";
import { projectRoot } from "../config/paths";
import { loadChannel, loadChannelIdentity } from "../channel";
import { channelLibrary } from "../channel/library";
import { catalogSamples } from "../remotion/scenes/channelSamples";
import { buildCatalogHtml, type CatalogData } from "./catalog";

export type ExportResult = { channel: string; files: number; elements: number; catalog: string };

/**
 * يصدّر مكتبة قناة واحدة بهويتها: كل عنصر من مكتبتها لكل ثيم من ثيماتها كملف SVG،
 * ومعها manifest.json وصفحة كتالوج تجمع كل شيء من الألف إلى الياء.
 * المخرجات في renders/elements/<القناة>/ (تُولَّد عند الحاجة ولا تُرفع إلى Git).
 */
export const exportElements = async (channelId: string, outDir = path.join(projectRoot, "renders", "elements", channelId)): Promise<ExportResult> => {
  const channel = loadChannel(channelId);
  const identity = loadChannelIdentity(channelId) as Identity;
  const themes: Record<ThemeId, Theme> = buildThemes(identity.themes as never);
  const lib = channelLibrary(channel);
  const allowed = new Set(lib.elements);
  // كل رسمة تُرندر داخل هوية القناة (لوحة ألوان العناصر)، ثم يُزال غلاف المزوّد
  const svg = (node: React.ReactElement) => {
    const markup = renderToStaticMarkup(<IdentityProvider identity={identity}>{node}</IdentityProvider>).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
    return markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  };
  await rm(outDir, { recursive: true, force: true });
  let files = 0;
  const elements = elementLibrary.filter((e) => allowed.has(e.id));
  const data: CatalogData = {
    channel: { id: channel.id, name: channel.nameDisplay ?? channel.name, nameLatin: channel.nameLatin, faces: channel.rules.faces, scripture: channel.rules.quran || channel.rules.hadith, sample: catalogSamples[channel.id] },
    fonts: { heading: identity.fonts?.heading ?? "El Messiri", body: identity.fonts?.body ?? "IBM Plex Sans Arabic", wordmark: identity.fonts?.wordmark ?? "Readex Pro" },
    themes: themeIds.map((id) => ({
      id,
      nameAr: themes[id].nameAr,
      domainAr: themes[id].domainAr,
      colors: themes[id].colors,
      style: themes[id].character.style,
    })),
    categories: categoryOrder.filter((c) => elements.some((e) => e.category === c)).map((c) => ({ id: c, nameAr: categoryNamesAr[c] })),
    elements: [],
    characters: [],
    logos: {} as Record<ThemeId, string>,
    sfx: sfxLibrary.map((s) => ({ ...s, categoryAr: sfxCategoryNamesAr[s.category] })),
  };

  for (const el of elements) {
    const entry: CatalogData["elements"][number] = {
      id: el.id,
      nameAr: el.nameAr,
      category: el.category,
      tags: el.tags,
      note: el.note,
      kind: el.kind ?? "prop",
      svg: {} as Record<ThemeId, string>,
      svgPortrait: el.kind === "backdrop" ? ({} as Record<ThemeId, string>) : undefined,
    };
    for (const id of themeIds) {
      const dir = path.join(outDir, id, el.category);
      await mkdir(dir, { recursive: true });
      if (el.kind === "backdrop") {
        const land = svg(<Element id={el.id} theme={themes[id]} width={1920} height={1080} />);
        const port = svg(<Element id={el.id} theme={themes[id]} width={1080} height={1920} />);
        await writeFile(path.join(dir, `${el.id}-landscape.svg`), land);
        await writeFile(path.join(dir, `${el.id}-portrait.svg`), port);
        entry.svg[id] = land;
        entry.svgPortrait![id] = port;
        files += 2;
      } else {
        const markup = svg(<Element id={el.id} theme={themes[id]} size={240} />);
        await writeFile(path.join(dir, `${el.id}.svg`), markup);
        entry.svg[id] = markup;
        files += 1;
      }
    }
    data.elements.push(entry);
  }

  // القناة التي تكتفي بالشخصيات التاريخية لا يُصدَّر لها الرواة العامّون
  for (const variant of channel.library?.characters === "figures" ? [] : characterVariants) {
    for (const pose of characterPoses) {
      const svgs = {} as Record<ThemeId, string>;
      for (const id of themeIds) {
        const dir = path.join(outDir, id, "characters");
        await mkdir(dir, { recursive: true });
        const markup = svg(<Character theme={themes[id]} variant={variant} pose={pose} height={300} />);
        await writeFile(path.join(dir, `${variant}-${pose}.svg`), markup);
        svgs[id] = markup;
        files += 1;
      }
      data.characters.push({ variant, pose, nameAr: characterNamesAr[variant], poseAr: characterPoseNamesAr[pose], svg: svgs });
    }
  }

  for (const id of themeIds) {
    data.logos[id] = svg(<LogoMark size={120} colors={themes[id].logo} mark={channel.logo} />);
  }

  const manifest = data.elements.map((e) => ({
    id: e.id,
    nameAr: e.nameAr,
    category: e.category,
    categoryAr: categoryNamesAr[e.category],
    kind: e.kind,
    tags: e.tags,
    note: e.note,
    files: Object.fromEntries(
      themeIds.map((t) => [
        t,
        e.kind === "backdrop"
          ? [`${t}/${e.category}/${e.id}-landscape.svg`, `${t}/${e.category}/${e.id}-portrait.svg`]
          : [`${t}/${e.category}/${e.id}.svg`],
      ]),
    ),
  }));
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify({ count: manifest.length, elements: manifest }, null, 2));
  const catalog = path.join(outDir, "catalog.html");
  await writeFile(catalog, buildCatalogHtml(data));
  return { channel: channel.id, files: files + 2, elements: elements.length, catalog };
};
