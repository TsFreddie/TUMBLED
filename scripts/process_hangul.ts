// Script to populate Hangul glyphs
// Requires pages.txt to be built via `./scripts/combine.ts`

import fs from "fs";
import path from "path";

const decompose = (codepoint: number) => {
  const SBase = 0xac00;
  const SIndex = codepoint - SBase;

  const LIndex = Math.floor(SIndex / 588);
  const VIndex = Math.floor((SIndex % 588) / 28);
  const TIndex = SIndex % 28;

  const V = [0, 1, 2, 3, 4, 5, 6, 7, 20];
  const H = [8, 12, 13, 17, 18];
  const T = TIndex > 0 ? "T" : "";

  const choseongType =
    (V.includes(VIndex) ? "V" : H.includes(VIndex) ? "H" : "") + T;

  return {
    choseong: `KL${LIndex}${choseongType}`,
    jungseong: `KV${VIndex}${T}`,
    jongseong: TIndex > 0 ? `KT${TIndex}` : "",
  };
};

const pages = fs.readFileSync(`./build/pages.txt`, "utf-8");
const segmentor = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const characters = Array.from(segmentor.segment(pages)).map((s) => s.segment);

const advance = parseInt(process.argv[2]);
if (isNaN(advance)) {
  console.error("Invalid advance width");
  process.exit(1);
}

const fontPath = process.argv[3];
if (!fontPath) {
  console.error("No font path provided");
  process.exit(1);
}

for (const char of characters) {
  const codepoint = char.codePointAt(0);
  if (!codepoint || codepoint < 0xac00 || codepoint > 0xd7a3) continue;

  const { choseong, jungseong, jongseong } = decompose(codepoint);

  const data = [`${advance}`];
  if (choseong) data.push(`0 0 ${choseong}`);
  if (jungseong) data.push(`0 0 ${jungseong}`);
  if (jongseong) data.push(`0 0 ${jongseong}`);

  const glyphPath = path.join(fontPath, "glyphs", `${codepoint}.txt`);

  if (fs.existsSync(glyphPath)) {
    continue;
  }

  fs.writeFileSync(glyphPath, data.join("\n"));
}
