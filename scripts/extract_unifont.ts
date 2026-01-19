import { FontExtractor } from "./extractor";
import fs from "fs";

const font = new FontExtractor("./data/fonts/unifont/unifont-17.0.03.otf");

const segmentor = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cjk = Array.from(
  segmentor.segment(fs.readFileSync("./build/pages.txt", "utf8")),
).map((s) => s.segment);

const topBase = 9;

fs.mkdirSync("./fonts/unifont", { recursive: true });
fs.mkdirSync("./fonts/unifont/glyphs", { recursive: true });
fs.mkdirSync("./fonts/unifont/shapes", { recursive: true });

for (const char of cjk) {
  const codepoint = char.codePointAt(0)!;
  const glyph = font.convert(codepoint, 16);

  if (glyph) {
    fs.writeFileSync(
      `./fonts/unifont/shapes/${codepoint}.txt`,
      `${topBase + glyph.top} ${glyph.left}\n${glyph.shape}`,
    );

    fs.writeFileSync(
      `./fonts/unifont/glyphs/${codepoint}.txt`,
      `16\n0 0 ${codepoint}`,
    );
  }
}

fs.writeFileSync(
  `./fonts/unifont/font.json`,
  JSON.stringify({ name: "unifont", height: 24, wildcardCodepoint: 9647 }),
);

// Writes the wildcard glyph to make the font buildable
fs.writeFileSync(`./fonts/unifont/glyphs/9647.txt`, `12\n0 0 WILDCARD`);
fs.writeFileSync(
  `./fonts/unifont/shapes/WILDCARD.txt`,
  `8 2
########
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
#      #
########
`,
);
