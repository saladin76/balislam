import React, { createContext, useContext } from "react";
import { ar, langPack, localDigits } from "./packs";
import type { LangPack } from "./types";

const Ctx = createContext<LangPack>(ar);

export const LangProvider: React.FC<{ lang?: string; children: React.ReactNode }> = ({ lang, children }) => <Ctx.Provider value={langPack(lang)}>{children}</Ctx.Provider>;

/** لغة الحلقة الحالية داخل القوالب. */
export const useLang = () => useContext(Ctx);

/** يعرض نصًا بأرقام لغة الحلقة (٠١٢ للعربية، 012 للتركية والإنجليزية). */
export const Digits: React.FC<{ children: string | number }> = ({ children }) => <>{localDigits(children, useLang())}</>;

type StringKey = Exclude<keyof LangPack["strings"], "grades">;

/** نص ثابت من حزمة اللغة: <T k="summary" /> */
export const T: React.FC<{ k: StringKey }> = ({ k }) => <>{useLang().strings[k]}</>;
