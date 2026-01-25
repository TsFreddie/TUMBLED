import { FontExtractor } from "./extractor";
import fs from "fs";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: process.argv,
  strict: false,
  allowPositionals: true,
  options: {
    force: {
      type: "boolean",
      short: "f",
    },
  },
});

// read extract definition
const definition = positionals[2]
  ? JSON.parse(fs.readFileSync(positionals[2], "utf-8"))
  : {};

const pageFile = definition.pageFile ?? "./build/pages.txt";
const topOffset = definition.topOffset ?? 9;
const leftOffset = definition.leftOffset ?? 0;
const advanceOffset = definition.advanceOffset ?? 0;
const fontName = definition.fontName ?? "unifont";
const fontSize = definition.fontSize ?? 24;
const fontFile =
  definition.fontFile ?? "./data/fonts/unifont/unifont-17.0.03.otf";
const renderWidth = definition.renderWidth ?? 16;
const renderHeight = definition.renderHeight ?? 16;
const wildcardHeight = definition.wildcardHeight ?? 16;
const wildcardWidth = definition.wildcardWidth ?? 7;
const forceAutohint = definition.forceAutohint ?? false;
const ranges: [number, number][] = definition.ranges ?? [[-Infinity, Infinity]];
const autoJiggle: false | [number, number] = definition.autoJiggle ?? false;

const segmentor = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cjk = Array.from(
  segmentor.segment(fs.readFileSync(pageFile, "utf8")),
).map((s) => s.segment);
const extractor = new FontExtractor(fontFile);

fs.mkdirSync(`./fonts/${fontName}`, { recursive: true });
fs.mkdirSync(`./fonts/${fontName}/glyphs`, { recursive: true });
fs.mkdirSync(`./fonts/${fontName}/shapes`, { recursive: true });

let written = 0;

for (const char of cjk) {
  const codepoint = char.codePointAt(0)!;
  if (!codepoint) continue;
  if (!ranges.some(([start, end]) => codepoint >= start && codepoint <= end)) {
    continue;
  }

  let glyph:
    | false
    | {
        shape: string;
        top: number;
        left: number;
        advance: number;
      } = false;

  if (typeof autoJiggle === "object") {
    glyph = extractor.autoJiggle(
      codepoint,
      autoJiggle[0],
      autoJiggle[1],
      renderWidth,
      renderHeight,
      forceAutohint,
    );
  } else {
    glyph = extractor.convert(
      codepoint,
      renderWidth,
      renderHeight,
      forceAutohint,
    );
  }

  if (glyph) {
    const top = glyph.shape ? topOffset + glyph.top : 0;
    const left = glyph.shape ? leftOffset + glyph.left : 0;

    if (top < 0 || left < 0) {
      console.log(`WARNING: OOB ${char} ${codepoint} ${top} ${left}`);
    }

    if (
      !values.force &&
      fs.existsSync(`./fonts/${fontName}/glyphs/${codepoint}.txt`)
    ) {
      continue;
    }

    fs.writeFileSync(
      `./fonts/${fontName}/shapes/${codepoint}.txt`,
      `${top} ${left}\n${glyph.shape}`,
    );

    fs.writeFileSync(
      `./fonts/${fontName}/glyphs/${codepoint}.txt`,
      `${Math.round(glyph.advance + advanceOffset)}\n0 0 ${codepoint}`,
    );
    written++;
  }
}

if (!fs.existsSync(`./fonts/${fontName}/font.json`)) {
  fs.writeFileSync(
    `./fonts/${fontName}/font.json`,
    JSON.stringify({
      name: fontName,
      height: fontSize,
      wildcardCodepoint: 9647,
    }),
  );
}

const generateWildcard = (width: number, height: number) => {
  // draw a box
  const lines = ["#".repeat(width)];
  for (let i = 0; i < height - 2; i++) {
    lines.push("#" + " ".repeat(width - 2) + "#");
  }
  lines.push("#".repeat(width));
  return lines.join("\n");
};

if (!fs.existsSync(`./fonts/${fontName}/glyphs/9647.txt`)) {
  // Writes the wildcard glyph to make the font buildable
  fs.writeFileSync(
    `./fonts/${fontName}/glyphs/9647.txt`,
    `${wildcardWidth + 2}\n0 0 WILDCARD`,
  );
  fs.writeFileSync(
    `./fonts/${fontName}/shapes/WILDCARD.txt`,
    `${fontSize - wildcardHeight} 1\n` +
      generateWildcard(wildcardWidth, wildcardHeight),
  );
  written++;
}

console.log(`Extracted and wrote ${written} glyphs`);
