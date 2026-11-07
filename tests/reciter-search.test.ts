import { describe, expect, it } from "vitest";
import { filterAudioEditions, previewReciterKey } from "../app/src/workspace/AlQuranCloudBrowser";

const voices=[
  {identifier:"ar.husary",name:"محمود خليل الحصري"},
  {identifier:"ar.alafasy",name:"مشاري العفاسي"},
  {identifier:"ar.minshawi",name:"محمد صديق المنشاوي"},
];
describe("Only AlQuran Cloud preview: three-channel isolation",()=>{
  it("lists the full returned catalog; no hard-coded list or Foundation search",()=>{
    expect(filterAudioEditions(voices,"")).toHaveLength(3);
  });
  it("filters Arabic names and edition identifiers",()=>{
    expect(filterAudioEditions(voices,"المنشاوي")).toEqual([voices[2]]);
    expect(filterAudioEditions(voices,"MIN")).toEqual([voices[2]]);
  });
  it("keeps reciter preview preferences separate between channel and episode",()=>{
    expect(previewReciterKey("balislam","001")).not.toBe(previewReciterKey("dafatir-alzaman","001"));
    expect(previewReciterKey("balislam","001")).not.toBe(previewReciterKey("balislam","002"));
  });
});
