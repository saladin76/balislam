import type { Domain, Theme, ThemeId } from "./types";

/** الألوان مطابقة لجدول الثيمات في دليل القناة. */
export const themes: Record<ThemeId, Theme> = {
  paper: {
    id: "paper",
    nameAr: "حبر وورق",
    domain: "psychology",
    domainAr: "النفس والسلوك",
    colors: {
      bg: "#F4F1EA",
      surface: "#FFFDF8",
      ink: "#1B1B1B",
      inkSoft: "#55524B",
      primary: "#1E6B5C",
      secondary: "#9FDCCB",
      highlight: "#9FDCCB",
      onHighlight: "#1B1B1B",
      captionBg: "#1B1B1B",
      captionInk: "#F4F1EA",
    },
    logo: { tile: "#1E6B5C", baa: "#F4F1EA", play: "#9FDCCB" },
    character: {
      style: "line",
      outline: "#1B1B1B",
      skin: ["#FFFDF8", "#FFFDF8"],
      garments: ["#FFFDF8", "#FFFDF8", "#FFFDF8", "#FFFDF8", "#FFFDF8"],
      cap: "#1E6B5C",
    },
    motif: "ink-lines",
  },
  family: {
    id: "family",
    nameAr: "دفء البيت",
    domain: "family",
    domainAr: "الأسرة والعلاقات",
    colors: {
      bg: "#F7EEE8",
      surface: "#FFFFFF",
      ink: "#3A2E39",
      inkSoft: "#5E4E5C",
      primary: "#C2566B",
      secondary: "#7FA88E",
      highlight: "#F2C7A5",
      onHighlight: "#3A2E39",
      captionBg: "#3A2E39",
      captionInk: "#F7EEE8",
    },
    logo: { tile: "#C2566B", baa: "#F7EEE8", play: "#F2C7A5" },
    character: {
      style: "flat",
      outline: "#3A2E39",
      skin: ["#E9C6A8", "#D9B08C"],
      garments: ["#C2566B", "#7FA88E", "#D98C6E", "#5E4E5C", "#4F7A60"],
      cap: "#FFFFFF",
    },
    motif: "house-circles",
  },
  night: {
    id: "night",
    nameAr: "ليلٌ هادئ",
    domain: "money",
    domainAr: "المال والدنيا والتأمل",
    colors: {
      bg: "#0E1A2B",
      surface: "#16263D",
      ink: "#F3EEE3",
      inkSoft: "#A9B4C6",
      primary: "#E2B24C",
      secondary: "#5FB8AE",
      highlight: "#E2B24C",
      onHighlight: "#0E1A2B",
      captionBg: "#F3EEE3",
      captionInk: "#0E1A2B",
    },
    logo: { tile: "#0E1A2B", baa: "#F3EEE3", play: "#E2B24C" },
    character: {
      style: "flat",
      outline: "#0E1A2B",
      skin: ["#E7C3A0", "#D2A782"],
      garments: ["#5FB8AE", "#E2B24C", "#E58E6B", "#33476A", "#5A6F94"],
      cap: "#F3EEE3",
    },
    motif: "stars",
  },
  warm: {
    id: "warm",
    nameAr: "أقواس دافئة",
    domain: "knowledge",
    domainAr: "العلم والتاريخ والحضارة",
    colors: {
      bg: "#EFE4D3",
      surface: "#FBF6EE",
      ink: "#2E3A2A",
      inkSoft: "#4A5546",
      primary: "#B4532F",
      secondary: "#D9A441",
      highlight: "#D9A441",
      onHighlight: "#2E3A2A",
      captionBg: "#2E3A2A",
      captionInk: "#FBF6EE",
    },
    logo: { tile: "#B4532F", baa: "#FBF6EE", play: "#D9A441" },
    character: {
      style: "flat",
      outline: "#2E3A2A",
      skin: ["#F2D2B0", "#DDB58F"],
      garments: ["#2E3A2A", "#B4532F", "#D9A441", "#7A5A44", "#4A5546"],
      cap: "#FBF6EE",
    },
    motif: "arches",
  },
};

export const themeIds = Object.keys(themes) as ThemeId[];

const domainToTheme: Record<Domain, ThemeId> = {
  psychology: "paper",
  family: "family",
  money: "night",
  knowledge: "warm",
};

/** الثيم يُختار تلقائيًا من مجال الحلقة. */
export const themeForDomain = (domain: Domain): Theme => themes[domainToTheme[domain]];

/** النسخة الأساسية لصورة القناة (الأقواس الدافئة). */
export const masterTheme = themes.warm;

export type { Domain, Theme, ThemeId } from "./types";
